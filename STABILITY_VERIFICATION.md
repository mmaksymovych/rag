# Test Stability Verification

## Overview

The agent now includes **stability verification** to ensure generated tests are deterministic and reliable. After a test passes initial generation, it must pass **3 consecutive runs** to be considered stable.

## Requirements

1. **Initial Test Generation**: Test must pass at least once during generation phase
2. **Stability Verification**: After initial pass, test must pass 3 consecutive runs
3. **Auto-Fix on Failure**: If test fails on 2nd or 3rd run, agent attempts to fix it
4. **Max Fix Attempts**: After 3 unsuccessful fix attempts, agent stops and reports problem
5. **RAG Integration**: Only stable tests (passed 3 consecutive runs) are added to RAG

## Implementation

### Workflow

```
1. Generate test code
2. Write test file
3. Run test (initial verification)
4. If passes → Start stability verification:
   a. Run test 3 times consecutively
   b. If any run fails:
      - Reflect on failure
      - Regenerate test with stability improvements
      - Rewrite test file
      - Reset and restart stability verification (3 runs again)
      - Track fix attempts (max 3)
   c. If all 3 runs pass → Test is stable
   d. If max fix attempts reached → Report as unstable
5. Add to RAG only if stable
```

### Key Components

#### `verifyTestStability()` Method

**Location**: `test-agent/src/agent/agent.service.ts`

**Parameters**:
- `fileName`: Test file name
- `testCode`: Current test code
- `missingTest`: Endpoint information
- `endpointInfo`: OpenAPI endpoint details
- `initialAttempts`: Number of generation attempts

**Returns**:
```typescript
{
  isStable: boolean;           // True if passed 3 consecutive runs
  successfulRuns: number;       // Number of successful runs (0-3)
  fixAttempts: number;         // Number of fix attempts made
  error?: string;              // Error message if unstable
}
```

**Behavior**:
- Runs test 3 times consecutively
- If any run fails:
  - Uses `ReflectionService` to analyze failure
  - Regenerates test with stability-focused improvements
  - Rewrites test file
  - Resets run counter and starts over
- Tracks fix attempts (max 3)
- Adds 500ms delay between successful runs to avoid timing issues

#### Updated `GeneratedTest` Interface

```typescript
export interface GeneratedTest {
  endpoint: string;
  method: string;
  fileName: string;
  filePath: string;
  testGenerated: boolean;
  testPassed: boolean;
  isStable?: boolean;          // NEW: True if passed 3 consecutive runs
  stabilityRuns?: number;      // NEW: Number of successful stability runs
  totalAttempts?: number;     // NEW: Total generation + fix attempts
  error?: string;
}
```

### Stability-Focused Improvements

When a test fails during stability verification, the agent:

1. **Analyzes the failure** using `ReflectionService`
2. **Generates stability-focused prompt**:
   ```
   [Original reflection improvements]
   
   IMPORTANT: This test failed on a subsequent run, indicating 
   non-deterministic behavior. Ensure the test is stable and handles:
   - Timing issues
   - Async operations
   - Potential race conditions
   - Properly
   ```
3. **Regenerates test** with improved prompt
4. **Rewrites test file**
5. **Restarts stability verification** (3 runs again)

### Logging

The stability verification includes comprehensive logging:

```
[GET /users] Initial test passed, verifying stability (3 runs required)
[GET /users] Starting stability verification (3 runs required)
[GET /users] Stability run 1/3
[GET /users] Stability run 1 passed (1/3 successful)
[GET /users] Stability run 2/3
[GET /users] Stability run 2 failed - test is non-deterministic
[GET /users] Attempting to fix non-deterministic test (fix attempt 1/3)
[GET /users] Regenerating test with stability improvements
[GET /users] Test regenerated, will retry stability verification
[GET /users] Stability run 1/3
...
[GET /users] Test verified as stable (3/3 runs passed)
```

### Result Reporting

The agent now reports:
- **Stable tests**: Tests that passed 3 consecutive runs
- **Unstable tests**: Tests that failed stability verification
- **Total attempts**: Includes both generation and fix attempts

**Example Response**:
```json
{
  "success": true,
  "message": "Generated 2/3 stable tests. 1 tests are unstable (non-deterministic).",
  "generatedTests": [
    {
      "endpoint": "/users",
      "method": "GET",
      "testGenerated": true,
      "testPassed": true,
      "isStable": true,
      "stabilityRuns": 3,
      "totalAttempts": 4
    },
    {
      "endpoint": "/users/:id",
      "method": "GET",
      "testGenerated": true,
      "testPassed": true,
      "isStable": false,
      "stabilityRuns": 1,
      "totalAttempts": 6,
      "error": "Test failed stability verification"
    }
  ]
}
```

## Configuration

- **Required Stable Runs**: 3 (hardcoded)
- **Max Fix Attempts**: 3 (hardcoded)
- **Delay Between Runs**: 500ms (to avoid timing issues)

## Benefits

1. **Reliability**: Only stable, deterministic tests are added to RAG
2. **Auto-Fix**: Automatically attempts to fix non-deterministic tests
3. **Clear Reporting**: Distinguishes between stable and unstable tests
4. **Prevents Flaky Tests**: Catches timing/race condition issues early
5. **Iterative Improvement**: Uses reflection to improve test stability

## Edge Cases Handled

1. **Test fails on 2nd run**: Agent fixes and restarts verification
2. **Test fails on 3rd run**: Agent fixes and restarts verification
3. **Test fails after 3 fix attempts**: Agent stops and reports as unstable
4. **Test passes 1st and 2nd, fails 3rd**: Agent fixes and restarts
5. **Test passes all 3 runs**: Test is marked as stable and added to RAG

## Future Enhancements (Optional)

1. **Configurable stability runs**: Make number of required runs configurable
2. **Stability metrics**: Track stability rates over time
3. **Advanced race condition detection**: Use LLM to identify specific race conditions
4. **Parallel execution**: Run multiple stability runs in parallel for faster verification

