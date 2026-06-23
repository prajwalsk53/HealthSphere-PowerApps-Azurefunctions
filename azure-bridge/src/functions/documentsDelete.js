const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER = process.env.DOCUMENTS_CONTAINER || 'documents';

app.http('documentsDelete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'bridge/documents/upload/{filename}',
  handler: async (request) => {
    try {
      const serviceClient = BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage);
      const containerClient = serviceClient.getContainerClient(CONTAINER);
      await containerClient.getBlockBlobClient(request.params.filename).deleteIfExists();
      return { jsonBody: { message: 'Deleted' } };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
