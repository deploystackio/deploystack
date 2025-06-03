const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Define the order we want tests to run
    const testOrder = [
      '1-setup.e2e.test.ts',
      '2-user-registration.e2e.test.ts', 
      '3-email-login.e2e.test.ts',
      '4-global-settings-check.e2e.test.ts'
    ];

    return tests.sort((testA, testB) => {
      const aName = testA.path.split('/').pop();
      const bName = testB.path.split('/').pop();
      
      const aIndex = testOrder.findIndex(name => aName.includes(name));
      const bIndex = testOrder.findIndex(name => bName.includes(name));
      
      // If both tests are in our order list, sort by their position
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // If only one is in our list, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      // For other tests, use default alphabetical sorting
      return aName.localeCompare(bName);
    });
  }
}

module.exports = CustomSequencer;
