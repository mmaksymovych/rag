/**
 * Weather tool for ReAct agent
 */
export const weatherTool = {
  name: 'getWeather',
  description: 'Get weather information for a specified city.',
  execute: async ({ city }: { city: string }) => {
    return `Weather in ${city}: 26°C, sunny ☀️`;
  },
};

