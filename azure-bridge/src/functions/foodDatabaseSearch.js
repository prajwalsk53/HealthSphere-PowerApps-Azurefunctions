const { app } = require('@azure/functions');
const axios = require('axios');

function mapAisle(aisle = '') {
  const a = aisle.toLowerCase();
  if (/meat|poultry/.test(a)) return 'Protein Food';
  if (/seafood|fish/.test(a)) return 'Protein Food';
  if (/dairy|cheese|egg/.test(a)) return 'Dairy';
  if (/produce|vegetable/.test(a)) return 'Vegetable';
  if (/fruit/.test(a)) return 'Fruit';
  if (/pasta|rice|cereal|grain|bread|bakery/.test(a)) return 'Grain';
  if (/nut|seed/.test(a)) return 'Snack/Processed';
  if (/beverage|drink/.test(a)) return 'Beverage';
  if (/sweet|candy|dessert/.test(a)) return 'Snack/Processed';
  return 'Other';
}

app.http('foodDatabaseSearch', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'bridge/food-database/search-api',
  handler: async (request) => {
    try {
      const q = request.query.get('q');
      if (!q || q.trim().length < 2) return { jsonBody: [] };

      const KEY = process.env.SPOONACULAR_API_KEY;
      if (!KEY) return { status: 500, jsonBody: { error: 'SPOONACULAR_API_KEY not configured on the Function App.' } };

      const { data: searchData } = await axios.get(
        'https://api.spoonacular.com/food/ingredients/search',
        { params: { query: q, number: 12, metaInformation: true, apiKey: KEY }, timeout: 10000 }
      );

      const items = searchData.results || [];
      if (!items.length) return { jsonBody: [] };

      const nutritionResults = await Promise.allSettled(
        items.map(item =>
          axios.get(
            `https://api.spoonacular.com/food/ingredients/${item.id}/information`,
            { params: { amount: 100, unit: 'grams', apiKey: KEY }, timeout: 10000 }
          )
        )
      );

      const foods = items.map((item, i) => {
        const infoRes = nutritionResults[i];
        const infoData = infoRes.status === 'fulfilled' ? infoRes.value.data : null;
        const nutrients = infoData?.nutrition?.nutrients || [];
        const get = (name) => {
          const n = nutrients.find(n => n.name.toLowerCase() === name.toLowerCase());
          return n ? +parseFloat(n.amount).toFixed(1) : 0;
        };
        return {
          spoonacular_id: item.id,
          food_name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
          category: mapAisle(item.aisle || ''),
          image: `https://spoonacular.com/cdn/ingredients_100x100/${item.image || 'food.jpg'}`,
          calories_per_100g: Math.round(get('Calories')),
          protein_g: get('Protein'),
          carbs_g: get('Carbohydrates'),
          sugar_g: get('Sugar'),
          fats_g: get('Fat'),
          fiber_g: get('Fiber'),
          sodium_mg: Math.round(get('Sodium')),
        };
      });

      return { jsonBody: foods };
    } catch (err) {
      return { status: 500, jsonBody: { error: err.message } };
    }
  },
});
