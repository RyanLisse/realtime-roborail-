import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { AgentConfig, AgentMetadata } from '../../types';
import { createHandoffTools } from '../../handoff';

interface AuthenticationData {
  phoneNumber: string;
  dateOfBirth: string;
  last4Digits: string;
  last4DigitsType: 'credit_card' | 'ssn';
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
  };
  firstName?: string;
  isAuthenticated: boolean;
  authenticatedAt?: number;
}

interface AuthenticationState {
  currentStep: string;
  collectedData: Partial<AuthenticationData>;
  attemptCount: number;
  errors: string[];
  lastActivity: number;
}

/**
 * Enhanced authentication agent with improved state management and error handling
 */
export class EnhancedAuthenticationAgent {
  private state: AuthenticationState = {
    currentStep: 'greeting',
    collectedData: {},
    attemptCount: 0,
    errors: [],
    lastActivity: Date.now()
  };

  private readonly metadata: AgentMetadata = {
    category: 'customer-service',
    complexity: 'intermediate',
    requiresAuthentication: false, // This agent provides authentication
    supportedLanguages: ['en'],
    version: '2.0.0',
    description: 'Enhanced authentication agent with state management and improved user experience'
  };

  /**
   * Validate phone number format
   */
  private validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate date of birth format
   */
  private validateDateOfBirth(dob: string): boolean {
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dobRegex.test(dob)) return false;
    
    const date = new Date(dob);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Validate last 4 digits
   */
  private validateLast4Digits(digits: string): boolean {
    return /^\d{4}$/.test(digits);
  }

  /**
   * Enhanced authentication tool with better validation
   */
  private createEnhancedAuthenticationTool() {
    return tool({
      name: "authenticate_user_information",
      description: "Enhanced authentication with validation and error handling",
      parameters: {
        type: "object",
        properties: {
          phone_number: {
            type: "string",
            description: "User's phone number formatted as '(xxx) xxx-xxxx'",
            pattern: "^\\(\\d{3}\\) \\d{3}-\\d{4}$",
          },
          last_4_digits: {
            type: "string",
            description: "Last 4 digits of credit card or SSN",
            pattern: "^\\d{4}$"
          },
          last_4_digits_type: {
            type: "string",
            enum: ["credit_card", "ssn"],
            description: "Type of last 4 digits provided",
          },
          date_of_birth: {
            type: "string",
            description: "Date of birth in YYYY-MM-DD format",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          },
        },
        required: ["phone_number", "date_of_birth", "last_4_digits", "last_4_digits_type"],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { phone_number, last_4_digits, last_4_digits_type, date_of_birth } = input;

        // Validate input
        const validationErrors: string[] = [];
        
        if (!this.validatePhoneNumber(phone_number)) {
          validationErrors.push('Invalid phone number format');
        }
        
        if (!this.validateLast4Digits(last_4_digits)) {
          validationErrors.push('Invalid last 4 digits format');
        }
        
        if (!this.validateDateOfBirth(date_of_birth)) {
          validationErrors.push('Invalid date of birth format');
        }

        if (validationErrors.length > 0) {
          this.state.errors.push(...validationErrors);
          return { 
            success: false, 
            errors: validationErrors,
            message: 'Validation failed. Please check your information and try again.'
          };
        }

        // Simulate authentication logic
        const isAuthenticated = Math.random() > 0.1; // 90% success rate for simulation

        if (isAuthenticated) {
          this.state.collectedData = {
            ...this.state.collectedData,
            phoneNumber: phone_number,
            last4Digits: last_4_digits,
            last4DigitsType: last_4_digits_type,
            dateOfBirth: date_of_birth,
            isAuthenticated: true,
            authenticatedAt: Date.now()
          };

          return { 
            success: true, 
            message: 'Authentication successful',
            authenticationId: `auth_${Date.now()}`,
            timestamp: new Date().toISOString()
          };
        } else {
          this.state.attemptCount += 1;
          this.state.errors.push('Authentication failed - information mismatch');
          
          return { 
            success: false, 
            message: 'Authentication failed. Please verify your information.',
            attemptCount: this.state.attemptCount,
            maxAttempts: 3
          };
        }
      },
    });
  }

  /**
   * Enhanced address saving tool with validation
   */
  private createEnhancedAddressTool() {
    return tool({
      name: "save_or_update_address",
      description: "Enhanced address saving with validation",
      parameters: {
        type: "object",
        properties: {
          phone_number: {
            type: "string",
            description: "Phone number associated with the address",
          },
          new_address: {
            type: "object",
            properties: {
              street: { type: "string", minLength: 5 },
              city: { type: "string", minLength: 2 },
              state: { type: "string", minLength: 2 },
              postal_code: { type: "string", pattern: "^\\d{5}(-\\d{4})?$" },
            },
            required: ["street", "city", "state", "postal_code"],
            additionalProperties: false,
          },
        },
        required: ["phone_number", "new_address"],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { phone_number, new_address } = input;

        // Validate phone number matches authenticated user
        if (this.state.collectedData.phoneNumber !== phone_number) {
          return {
            success: false,
            error: 'Phone number does not match authenticated user'
          };
        }

        // Validate address fields
        const { street, city, state, postal_code } = new_address;
        const validationErrors: string[] = [];

        if (!street || street.length < 5) {
          validationErrors.push('Street address must be at least 5 characters');
        }

        if (!city || city.length < 2) {
          validationErrors.push('City must be at least 2 characters');
        }

        if (!state || state.length < 2) {
          validationErrors.push('State must be at least 2 characters');
        }

        if (!postal_code || !/^\d{5}(-\d{4})?$/.test(postal_code)) {
          validationErrors.push('Invalid postal code format');
        }

        if (validationErrors.length > 0) {
          return {
            success: false,
            errors: validationErrors,
            message: 'Address validation failed'
          };
        }

        // Save address
        this.state.collectedData.address = {
          street,
          city,
          state,
          postalCode: postal_code
        };

        return { 
          success: true,
          message: 'Address saved successfully',
          addressId: `addr_${Date.now()}`
        };
      },
    });
  }

  /**
   * Enhanced offer response tool with analytics
   */
  private createEnhancedOfferTool() {
    return tool({
      name: "update_user_offer_response",
      description: "Enhanced offer response tracking with analytics",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string" },
          offer_id: { type: "string" },
          user_response: {
            type: "string",
            enum: ["ACCEPTED", "DECLINED", "REMIND_LATER"],
          },
          interaction_context: {
            type: "object",
            properties: {
              response_time_seconds: { type: "number" },
              interruption_occurred: { type: "boolean" },
              questions_asked: { type: "number" }
            }
          }
        },
        required: ["phone", "offer_id", "user_response"],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { phone, offer_id, user_response, interaction_context } = input;

        // Validate phone matches authenticated user
        if (this.state.collectedData.phoneNumber !== phone) {
          return {
            success: false,
            error: 'Phone number does not match authenticated user'
          };
        }

        // Record offer response with enhanced context
        const offerResponse = {
          offerId: offer_id,
          response: user_response,
          timestamp: Date.now(),
          phoneNumber: phone,
          context: interaction_context || {},
          authenticationSession: this.state.collectedData.authenticatedAt
        };

        return { 
          success: true,
          message: 'Offer response recorded',
          responseId: `resp_${Date.now()}`,
          nextSteps: user_response === 'ACCEPTED' 
            ? 'You will receive welcome materials via email within 24 hours'
            : user_response === 'REMIND_LATER'
            ? 'We will follow up with you in 7 days'
            : 'Thank you for your time'
        };
      },
    });
  }

  /**
   * State management tool for debugging and monitoring
   */
  private createStateTool() {
    return tool({
      name: "get_authentication_state",
      description: "Get current authentication state for debugging",
      parameters: {
        type: "object",
        properties: {
          include_sensitive: {
            type: "boolean",
            description: "Whether to include sensitive information",
            default: false
          }
        },
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { include_sensitive = false } = input;

        const safeState = {
          currentStep: this.state.currentStep,
          isAuthenticated: this.state.collectedData.isAuthenticated || false,
          attemptCount: this.state.attemptCount,
          errorCount: this.state.errors.length,
          lastActivity: new Date(this.state.lastActivity).toISOString(),
          hasPhoneNumber: !!this.state.collectedData.phoneNumber,
          hasDateOfBirth: !!this.state.collectedData.dateOfBirth,
          hasLast4Digits: !!this.state.collectedData.last4Digits,
          hasAddress: !!this.state.collectedData.address
        };

        if (include_sensitive) {
          return {
            ...safeState,
            collectedData: this.state.collectedData,
            errors: this.state.errors
          };
        }

        return safeState;
      },
    });
  }

  /**
   * Create the enhanced authentication agent
   */
  createAgent(availableAgents: RealtimeAgent[] = []): RealtimeAgent {
    const { tools: handoffTools } = createHandoffTools(availableAgents);

    const enhancedInstructions = `
# Enhanced Authentication Agent

You are an advanced authentication agent for Snowy Peak Boards with enhanced capabilities for state management, error handling, and user experience optimization.

## Key Improvements
- Enhanced validation and error handling
- State management for better conversation flow
- Analytics and monitoring capabilities
- Improved security and data protection

## Authentication Flow
1. **Greeting**: Warm welcome with clear expectations
2. **Name Collection**: First name only, no verification needed
3. **Phone Verification**: Collect and confirm digit by digit
4. **Date of Birth**: Collect and confirm format
5. **Last 4 Digits**: SSN or Credit Card with type confirmation
6. **Authentication**: Call enhanced authentication tool
7. **Address**: Collect and validate if needed
8. **Offer Disclosure**: Present loyalty program offer
9. **Post-Authentication**: Route to appropriate specialist

## Enhanced Features
- Real-time validation of all inputs
- State tracking for conversation continuity
- Error recovery and retry mechanisms
- Analytics collection for offer responses
- Security monitoring and audit trails

## Error Handling
- Validate all inputs before processing
- Provide clear error messages
- Track attempt counts and implement limits
- Graceful fallback for authentication failures

## State Management
- Track conversation progress
- Preserve context across interactions
- Monitor authentication status
- Handle interruptions and resumptions

${this.getBaseInstructions()}
`;

    return new RealtimeAgent({
      name: 'enhancedAuthentication',
      voice: 'sage',
      handoffDescription: 'Enhanced authentication agent with advanced state management and error handling capabilities',
      instructions: enhancedInstructions,
      tools: [
        this.createEnhancedAuthenticationTool(),
        this.createEnhancedAddressTool(),
        this.createEnhancedOfferTool(),
        this.createStateTool(),
        ...handoffTools
      ],
      handoffs: [] // Will be populated when integrated
    });
  }

  /**
   * Get base instructions from original agent
   */
  private getBaseInstructions(): string {
    return `
# Base Authentication Flow (Enhanced)

## Personality and Tone
You maintain the same warm, approachable personality as the original authentication agent, but with enhanced technical capabilities and better error handling.

## Conversation States
Follow the same conversation flow but with enhanced validation and state management:

1. **greeting**: Begin with warm welcome and set expectations
2. **get_first_name**: Collect first name without verification
3. **get_and_verify_phone**: Collect and verify phone number digit by digit
4. **authentication_DOB**: Collect and confirm date of birth
5. **authentication_SSN_CC**: Collect last 4 digits and authenticate
6. **get_user_address**: Collect and validate address information
7. **disclosure_offer**: Present loyalty program offer
8. **post_disclosure_assistance**: Route to appropriate specialist

## Enhanced Validation Rules
- Phone numbers must match format: (xxx) xxx-xxxx
- Dates must be in YYYY-MM-DD format and valid dates
- Last 4 digits must be exactly 4 numeric characters
- Addresses must meet minimum length requirements
- All inputs are validated before processing

## Error Recovery
- Clear, helpful error messages
- Retry mechanisms for failed validations
- State preservation during error recovery
- Graceful degradation for system issues

## Security Enhancements
- Input sanitization and validation
- Audit trail for all authentication attempts
- Secure handling of sensitive information
- Rate limiting for authentication attempts
`;
  }

  /**
   * Reset agent state
   */
  resetState(): void {
    this.state = {
      currentStep: 'greeting',
      collectedData: {},
      attemptCount: 0,
      errors: [],
      lastActivity: Date.now()
    };
  }

  /**
   * Get current state (for debugging)
   */
  getState(): AuthenticationState {
    return { ...this.state };
  }

  /**
   * Get agent metadata
   */
  getMetadata(): AgentMetadata {
    return { ...this.metadata };
  }
}

// Export factory function for easy instantiation
export const createEnhancedAuthenticationAgent = (availableAgents: RealtimeAgent[] = []) => {
  const enhancedAuth = new EnhancedAuthenticationAgent();
  return enhancedAuth.createAgent(availableAgents);
};

// Export the class for advanced usage
export { EnhancedAuthenticationAgent };