// Test project using vulnerable lodash package
const _ = require('lodash');

console.log('Test project using lodash version:', require('lodash/package.json').version);

// Example usage
const obj = {};
_.defaultsDeep(obj, { a: { b: 2 } });
console.log('Using lodash defaultsDeep function');

