const { app } = require('@azure/functions');
const axios = require('axios');

app.http('aiFoodSearch', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'bridge/ai/food-search',
  handler: async (request) => {
    try {
      const query = request.query.get('query');
      if (!query || query.trim().length < 2) return { jsonBody: [] };
      const KEY = process.env.SPOONACULAR_API_KEY;
      if (!KEY) return { jsonBody: [] };

      const { data: searchData } = await axios.get('https://api.spoonacular.com/food/ingredients/search', {
        params: { query, number: 10, apiKey: KEY }, timeout: 10000,
      });
      const items = searchData.results || [];
      if (!items.length) return { jsonBody: [] };

      const nutritionResults = await Promise.allSettled(
        items.map(item => axios.get(`https://api.spoonacular.com/food/ingredients/${item.id}/information`, {
          params: { amount: 100, unit: 'grams', apiKey: KEY }, timeout: 10000,
        }))
      );

      const spoonacular = items.map((item, i) => {
        const infoRes = nutritionResults[i];
        const nutrients = infoRes.status === 'fulfilled' ? (infoRes.value.data?.nutrition?.nutrients || []) : [];
        const get = (name) => {
          const n = nutrients.find(n => n.name.toLowerCase() === name.toLowerCase());
          return n ? +parseFloat(n.amount).toFixed(1) : null;
        };
        return {
          id: item.id,
          name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
          calories: get('Calories'),
          protein: get('Protein'),
          carbs: get('Carbohydrates'),
          fat: get('Fat'),
          fiber: get('Fiber'),
          source: 'spoonacular',
        };
      });
      return { jsonBody: spoonacular };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
