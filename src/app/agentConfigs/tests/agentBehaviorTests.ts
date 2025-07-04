import { 
  AgentTestCase, 
  TestAssertion, 
  AgentConfig, 
  RealtimeAgent,
  AgentEventTracker,
  AgentStateManager
} from '../types';
import { defaultValidator } from '../utils';

/**
 * Test framework for agent behaviors and configurations
 */
export class AgentBehaviorTester {
  private testResults: Map<string, any> = new Map();
  private eventTracker = new AgentEventTracker();
  private stateManager = new AgentStateManager();

  /**
   * Run a single test case
   */
  async runTestCase(testCase: AgentTestCase): Promise<{ passed: boolean; results: any }> {
    console.log(`Running test: ${testCase.name}`);
    
    const results = {
      testName: testCase.name,
      scenario: testCase.scenario,
      input: testCase.input,
      startTime: Date.now(),
      passed: false,
      assertions: [] as any[],
      errors: [] as string[],
      endTime: 0
    };

    try {
      // Simulate agent interaction
      const response = await this.simulateAgentInteraction(testCase);
      
      // Run assertions
      for (const assertion of testCase.assertions) {
        const assertionResult = this.runAssertion(assertion, response, testCase);
        results.assertions.push(assertionResult);
      }

      // Check if all assertions passed
      results.passed = results.assertions.every(a => a.passed);
      
    } catch (error) {
      results.errors.push(`Test execution error: ${error}`);
      results.passed = false;
    } finally {
      results.endTime = Date.now();
    }

    this.testResults.set(testCase.name, results);
    return { passed: results.passed, results };
  }

  /**
   * Run multiple test cases
   */
  async runTestSuite(testCases: AgentTestCase[]): Promise<{ passed: number; failed: number; results: any[] }> {
    const results = [];
    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
      const result = await this.runTestCase(testCase);
      results.push(result.results);
      
      if (result.passed) {
        passed++;
      } else {
        failed++;
      }
    }

    return { passed, failed, results };
  }

  /**
   * Simulate agent interaction for testing
   */
  private async simulateAgentInteraction(testCase: AgentTestCase): Promise<any> {
    // This would integrate with the actual agent execution in a real implementation
    // For now, we simulate based on expected patterns
    
    const mockResponse = {
      message: this.generateMockResponse(testCase),
      agentName: testCase.expectedAgent || 'testAgent',
      toolsCalled: testCase.expectedTools || [],
      timestamp: Date.now(),
      metadata: {
        scenario: testCase.scenario,
        confidence: 0.85
      }
    };

    return mockResponse;
  }

  /**
   * Generate mock response based on test case
   */
  private generateMockResponse(testCase: AgentTestCase): string {
    const input = testCase.input.toLowerCase();
    
    // Authentication flow responses
    if (input.includes('hello') || input.includes('hi')) {
      return "Hello, this is Snowy Peak Boards. Thanks for reaching out! How can I help you today?";
    }
    
    if (input.includes('billing') || input.includes('account')) {
      return "I'll help you with your billing inquiry. May I have your phone number to look up your account?";
    }
    
    if (input.includes('return') || input.includes('refund')) {
      return "I can help you with returns. Let me look up your order information first.";
    }
    
    if (input.includes('product') || input.includes('snowboard')) {
      return "I'd be happy to help you find the perfect snowboard! What's your skill level and riding style?";
    }
    
    if (input.includes('transfer') || input.includes('human')) {
      return "Let me transfer you to a specialist who can better assist you.";
    }
    
    return testCase.expectedOutput || "I'm here to help you with your inquiry.";
  }

  /**
   * Run a single assertion
   */
  private runAssertion(assertion: TestAssertion, response: any, testCase: AgentTestCase): any {
    const result = {
      type: assertion.type,
      description: assertion.description || `Check ${assertion.type}`,
      passed: false,
      expected: assertion.value,
      actual: null as any,
      error: null as string | null
    };

    try {
      switch (assertion.type) {
        case 'contains':
          result.actual = response.message;
          result.passed = response.message.toLowerCase().includes(assertion.value.toLowerCase());
          break;

        case 'equals':
          result.actual = response.message;
          result.passed = response.message === assertion.value;
          break;

        case 'matches':
          result.actual = response.message;
          const regex = new RegExp(assertion.value);
          result.passed = regex.test(response.message);
          break;

        case 'tool-called':
          result.actual = response.toolsCalled;
          result.passed = response.toolsCalled.includes(assertion.value);
          break;

        case 'agent-handoff':
          result.actual = response.agentName;
          result.passed = response.agentName === assertion.value;
          break;

        default:
          result.error = `Unknown assertion type: ${assertion.type}`;
      }
    } catch (error) {
      result.error = `Assertion error: ${error}`;
      result.passed = false;
    }

    return result;
  }

  /**
   * Get test results
   */
  getTestResults(): Map<string, any> {
    return new Map(this.testResults);
  }

  /**
   * Generate test report
   */
  generateReport(): string {
    const results = Array.from(this.testResults.values());
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    let report = `\n# Agent Behavior Test Report\n\n`;
    report += `**Summary:**\n`;
    report += `- Total Tests: ${totalTests}\n`;
    report += `- Passed: ${passedTests}\n`;
    report += `- Failed: ${failedTests}\n`;
    report += `- Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n\n`;

    if (failedTests > 0) {
      report += `## Failed Tests\n\n`;
      results.filter(r => !r.passed).forEach(result => {
        report += `### ${result.testName}\n`;
        report += `- **Scenario:** ${result.scenario}\n`;
        report += `- **Input:** ${result.input}\n`;
        report += `- **Errors:** ${result.errors.join(', ')}\n`;
        
        const failedAssertions = result.assertions.filter((a: any) => !a.passed);
        if (failedAssertions.length > 0) {
          report += `- **Failed Assertions:**\n`;
          failedAssertions.forEach((assertion: any) => {
            report += `  - ${assertion.description}: Expected "${assertion.expected}", got "${assertion.actual}"\n`;
          });
        }
        report += `\n`;
      });
    }

    return report;
  }
}

/**
 * Test cases for authentication agent
 */
export const authenticationTestCases: AgentTestCase[] = [
  {
    name: 'greeting_response',
    description: 'Test initial greeting response',
    scenario: 'customerServiceRetail',
    input: 'Hello',
    expectedOutput: 'Hello, this is Snowy Peak Boards',
    expectedAgent: 'authentication',
    expectedTools: [],
    assertions: [
      {
        type: 'contains',
        value: 'Snowy Peak Boards',
        description: 'Response should contain company name'
      },
      {
        type: 'contains',
        value: 'help',
        description: 'Response should offer help'
      }
    ]
  },
  {
    name: 'phone_number_collection',
    description: 'Test phone number collection flow',
    scenario: 'customerServiceRetail',
    input: 'I need help with my account',
    expectedAgent: 'authentication',
    expectedTools: [],
    assertions: [
      {
        type: 'contains',
        value: 'phone number',
        description: 'Should ask for phone number'
      }
    ]
  },
  {
    name: 'authentication_tool_call',
    description: 'Test authentication tool is called',
    scenario: 'customerServiceRetail', 
    input: 'My phone is (555) 123-4567, DOB is 1990-01-01, last 4 of SSN is 1234',
    expectedAgent: 'authentication',
    expectedTools: ['authenticate_user_information'],
    assertions: [
      {
        type: 'tool-called',
        value: 'authenticate_user_information',
        description: 'Should call authentication tool'
      }
    ]
  }
];

/**
 * Test cases for sales agent
 */
export const salesTestCases: AgentTestCase[] = [
  {
    name: 'product_inquiry',
    description: 'Test product inquiry handling',
    scenario: 'customerServiceRetail',
    input: 'I\'m looking for a snowboard',
    expectedAgent: 'salesAgent',
    expectedTools: ['lookupAdvancedSales'],
    assertions: [
      {
        type: 'contains',
        value: 'snowboard',
        description: 'Response should acknowledge snowboard inquiry'
      },
      {
        type: 'tool-called',
        value: 'lookupAdvancedSales',
        description: 'Should call product lookup tool'
      }
    ]
  },
  {
    name: 'add_to_cart',
    description: 'Test adding item to cart',
    scenario: 'customerServiceRetail',
    input: 'Add the Alpine Blade Pro to my cart',
    expectedAgent: 'salesAgent',
    expectedTools: ['addToCartAdvanced'],
    assertions: [
      {
        type: 'tool-called',
        value: 'addToCartAdvanced',
        description: 'Should call add to cart tool'
      },
      {
        type: 'contains',
        value: 'cart',
        description: 'Response should mention cart'
      }
    ]
  }
];

/**
 * Test cases for returns agent
 */
export const returnsTestCases: AgentTestCase[] = [
  {
    name: 'return_request',
    description: 'Test return request handling',
    scenario: 'customerServiceRetail',
    input: 'I want to return my snowboard',
    expectedAgent: 'returns',
    expectedTools: ['lookupOrders'],
    assertions: [
      {
        type: 'contains',
        value: 'return',
        description: 'Response should acknowledge return request'
      },
      {
        type: 'tool-called',
        value: 'lookupOrders',
        description: 'Should look up orders'
      }
    ]
  },
  {
    name: 'policy_check',
    description: 'Test policy lookup for returns',
    scenario: 'customerServiceRetail',
    input: 'What is your return policy?',
    expectedAgent: 'returns',
    expectedTools: ['retrievePolicy'],
    assertions: [
      {
        type: 'tool-called',
        value: 'retrievePolicy',
        description: 'Should retrieve policy information'
      }
    ]
  }
];

/**
 * Test cases for handoff mechanisms
 */
export const handoffTestCases: AgentTestCase[] = [
  {
    name: 'agent_transfer',
    description: 'Test agent transfer functionality',
    scenario: 'customerServiceRetail',
    input: 'Transfer me to sales',
    expectedTools: ['agent_transfer'],
    assertions: [
      {
        type: 'tool-called',
        value: 'agent_transfer',
        description: 'Should call agent transfer tool'
      }
    ]
  },
  {
    name: 'escalation',
    description: 'Test smart escalation',
    scenario: 'customerServiceRetail',
    input: 'I\'m very frustrated with this billing issue',
    expectedTools: ['smart_escalation'],
    assertions: [
      {
        type: 'tool-called',
        value: 'smart_escalation',
        description: 'Should trigger smart escalation'
      }
    ]
  }
];

/**
 * Test cases for Chat-Supervisor pattern
 */
export const chatSupervisorTestCases: AgentTestCase[] = [
  {
    name: 'simple_greeting',
    description: 'Test simple greeting stays with chat agent',
    scenario: 'chatSupervisor',
    input: 'Hi',
    expectedAgent: 'chatAgent',
    expectedTools: [],
    assertions: [
      {
        type: 'agent-handoff',
        value: 'chatAgent',
        description: 'Simple greeting should stay with chat agent'
      }
    ]
  },
  {
    name: 'complex_billing_query',
    description: 'Test complex query escalates to supervisor',
    scenario: 'chatSupervisor',
    input: 'Why was I charged twice on my last bill?',
    expectedAgent: 'supervisor',
    expectedTools: ['getEnhancedResponseFromSupervisor'],
    assertions: [
      {
        type: 'tool-called',
        value: 'getEnhancedResponseFromSupervisor',
        description: 'Complex billing query should escalate to supervisor'
      }
    ]
  }
];

/**
 * Configuration validation tests
 */
export const configValidationTestCases: AgentTestCase[] = [
  {
    name: 'valid_agent_config',
    description: 'Test valid agent configuration passes validation',
    scenario: 'validation',
    input: 'validate agent config',
    assertions: [
      {
        type: 'equals',
        value: true,
        description: 'Valid configuration should pass validation'
      }
    ]
  },
  {
    name: 'invalid_agent_name',
    description: 'Test invalid agent name fails validation',
    scenario: 'validation',
    input: 'validate agent with invalid name',
    assertions: [
      {
        type: 'equals',
        value: false,
        description: 'Invalid agent name should fail validation'
      }
    ]
  }
];

/**
 * Performance test cases
 */
export const performanceTestCases: AgentTestCase[] = [
  {
    name: 'response_time',
    description: 'Test agent response time is acceptable',
    scenario: 'performance',
    input: 'Quick response test',
    assertions: [
      {
        type: 'matches',
        value: '\\d+ms',
        description: 'Response should include timing information'
      }
    ]
  },
  {
    name: 'concurrent_requests',
    description: 'Test handling multiple concurrent requests',
    scenario: 'performance',
    input: 'concurrent test',
    assertions: [
      {
        type: 'contains',
        value: 'success',
        description: 'Should handle concurrent requests successfully'
      }
    ]
  }
];

/**
 * All test cases combined
 */
export const allTestCases: AgentTestCase[] = [
  ...authenticationTestCases,
  ...salesTestCases,
  ...returnsTestCases,
  ...handoffTestCases,
  ...chatSupervisorTestCases,
  ...configValidationTestCases,
  ...performanceTestCases
];

/**
 * Test utilities for agent validation
 */
export const testUtils = {
  /**
   * Validate agent configuration
   */
  validateAgentConfig(config: AgentConfig): { isValid: boolean; errors: string[] } {
    return defaultValidator.validateAgentConfig(config);
  },

  /**
   * Create test agent for testing
   */
  createTestAgent(name: string, instructions: string): RealtimeAgent {
    return {
      name,
      instructions,
      voice: 'sage',
      tools: [],
      handoffs: [],
      handoffDescription: `Test agent for ${name}`
    } as RealtimeAgent;
  },

  /**
   * Generate test report
   */
  generateTestReport(results: any[]): string {
    const tester = new AgentBehaviorTester();
    results.forEach(result => {
      tester.testResults.set(result.testName, result);
    });
    return tester.generateReport();
  },

  /**
   * Run validation tests
   */
  runValidationTests(): { passed: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Test valid configuration
    const validConfig: AgentConfig = {
      name: 'testAgent',
      instructions: 'Test agent instructions that are long enough to pass validation',
      voice: 'sage',
      tools: [],
      handoffs: []
    };
    
    const validResult = defaultValidator.validateAgentConfig(validConfig);
    if (!validResult.isValid) {
      errors.push(`Valid config failed validation: ${validResult.errors.join(', ')}`);
    }

    // Test invalid configuration
    const invalidConfig: AgentConfig = {
      name: '', // Invalid empty name
      instructions: 'Short', // Too short
      voice: 'sage'
    };
    
    const invalidResult = defaultValidator.validateAgentConfig(invalidConfig);
    if (invalidResult.isValid) {
      errors.push('Invalid config passed validation when it should have failed');
    }

    return {
      passed: errors.length === 0,
      errors
    };
  }
};

// Export the tester class for external use
export { AgentBehaviorTester };