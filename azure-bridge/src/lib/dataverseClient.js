const axios = require('axios');

let cachedToken = null;
let tokenExpiry = 0;

async function getDataverseToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry - 60000) return cachedToken;

  const tenantId = process.env.DATAVERSE_TENANT_ID;
  const clientId = process.env.DATAVERSE_CLIENT_ID;
  const clientSecret = process.env.DATAVERSE_CLIENT_SECRET;
  const resource = process.env.DATAVERSE_RESOURCE;

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: `${resource}/.default`,
  });

  const { data } = await axios.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );

  cachedToken = data.access_token;
  tokenExpiry = now + data.expires_in * 1000;
  return cachedToken;
}

async function dataverseGet(path) {
  const token = await getDataverseToken();
  const resource = process.env.DATAVERSE_RESOURCE;
  const { data } = await axios.get(`${resource}/api/data/v9.2/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
  });
  return data;
}

module.exports = { getDataverseToken, dataverseGet };
