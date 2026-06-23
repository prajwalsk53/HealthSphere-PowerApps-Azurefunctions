const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = process.env.DOCUMENTS_CONTAINER || 'documents';

async function getContainerClient() {
  const serviceClient = BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage);
  const containerClient = serviceClient.getContainerClient(CONTAINER);
  await containerClient.createIfNotExists({ access: 'blob' });
  return containerClient;
}

app.http('documentsUpload', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'bridge/documents/upload',
  handler: async (request) => {
    try {
      const formData = await request.formData();
      const file = formData.get('doc_file');
      if (!file || typeof file.arrayBuffer !== 'function') {
        return { status: 400, jsonBody: { error: 'No file uploaded' } };
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const blobName = `${Date.now()}-${file.name}`;
      const containerClient = await getContainerClient();
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: file.type || 'application/octet-stream' } });

      return {
        status: 201,
        jsonBody: {
          filePath: blobName,
          fileUrl: blockBlobClient.url,
          fileName: file.name,
          fileType: file.type,
          fileSize: buffer.length,
        },
      };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
