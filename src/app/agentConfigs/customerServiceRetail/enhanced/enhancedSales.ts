import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { AgentMetadata } from '../../types';
import { createHandoffTools } from '../../handoff';

interface Product {
  item_id: string;
  type: 'snowboard' | 'apparel' | 'boots' | 'accessories';
  name: string;
  retail_price_usd: number;
  sale_price_usd?: number;
  sale_discount_pct?: number;
  description?: string;
  specifications?: Record<string, any>;
  availability: 'in_stock' | 'low_stock' | 'out_of_stock';
  rating?: number;
  reviews_count?: number;
}

interface SalesAnalytics {
  viewedProducts: string[];
  cartAdditions: string[];
  priceComparisons: number;
  categoryInterests: string[];
  sessionStartTime: number;
  lastActivity: number;
}

interface PersonalizationData {
  skillLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  ridingStyle?: 'freestyle' | 'all-mountain' | 'powder' | 'carving';
  budgetRange?: { min: number; max: number };
  preferredBrands?: string[];
  previousPurchases?: string[];
}

/**
 * Enhanced sales agent with personalization and advanced analytics
 */
export class EnhancedSalesAgent {
  private analytics: SalesAnalytics = {
    viewedProducts: [],
    cartAdditions: [],
    priceComparisons: 0,
    categoryInterests: [],
    sessionStartTime: Date.now(),
    lastActivity: Date.now()
  };

  private personalization: PersonalizationData = {};

  private readonly metadata: AgentMetadata = {
    category: 'customer-service',
    complexity: 'intermediate',
    requiresAuthentication: false,
    supportedLanguages: ['en'],
    version: '2.0.0',
    description: 'Enhanced sales agent with personalization, recommendations, and advanced analytics'
  };

  /**
   * Enhanced product data with more details
   */
  private getEnhancedProductData(): Product[] {
    return [
      {
        item_id: '101',
        type: 'snowboard',
        name: 'Alpine Blade Pro',
        retail_price_usd: 450,
        sale_price_usd: 360,
        sale_discount_pct: 20,
        description: 'Professional all-mountain snowboard perfect for advanced riders',
        specifications: {
          length_options: [150, 153, 156, 159, 162],
          flex: 'medium-stiff',
          shape: 'directional',
          camber: 'traditional'
        },
        availability: 'in_stock',
        rating: 4.8,
        reviews_count: 156
      },
      {
        item_id: '102',
        type: 'snowboard',
        name: 'Peak Bomber',
        retail_price_usd: 499,
        sale_price_usd: 374,
        sale_discount_pct: 25,
        description: 'High-performance freestyle board for park and pipe riding',
        specifications: {
          length_options: [148, 151, 154, 157],
          flex: 'medium',
          shape: 'twin',
          camber: 'hybrid'
        },
        availability: 'low_stock',
        rating: 4.6,
        reviews_count: 89
      },
      {
        item_id: '201',
        type: 'apparel',
        name: 'Thermal Jacket Pro',
        retail_price_usd: 120,
        sale_price_usd: 84,
        sale_discount_pct: 30,
        description: 'Waterproof thermal jacket with advanced breathability',
        specifications: {
          sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
          waterproof_rating: '20000mm',
          breathability: '20000g/m²/24h',
          features: ['pit zips', 'snow skirt', 'helmet compatible hood']
        },
        availability: 'in_stock',
        rating: 4.7,
        reviews_count: 203
      },
      {
        item_id: '301',
        type: 'boots',
        name: 'Glacier Grip Elite',
        retail_price_usd: 250,
        sale_price_usd: 200,
        sale_discount_pct: 20,
        description: 'Professional snowboard boots with heat-moldable liner',
        specifications: {
          sizes: [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12],
          flex: 'stiff',
          lacing: 'BOA',
          liner: 'heat-moldable'
        },
        availability: 'in_stock',
        rating: 4.9,
        reviews_count: 127
      }
    ];
  }

  /**
   * Advanced product lookup with filtering and recommendations
   */
  private createAdvancedProductLookupTool() {
    return tool({
      name: 'lookupAdvancedSales',
      description: 'Advanced product lookup with filtering, sorting, and personalized recommendations',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['snowboard', 'apparel', 'boots', 'accessories', 'any'],
            description: 'Product category to search'
          },
          filters: {
            type: 'object',
            properties: {
              price_range: {
                type: 'object',
                properties: {
                  min: { type: 'number' },
                  max: { type: 'number' }
                }
              },
              availability: {
                type: 'string',
                enum: ['in_stock', 'low_stock', 'out_of_stock', 'available']
              },
              rating_min: { type: 'number', minimum: 0, maximum: 5 },
              on_sale: { type: 'boolean' }
            }
          },
          sort_by: {
            type: 'string',
            enum: ['price_low', 'price_high', 'rating', 'discount', 'popularity'],
            description: 'How to sort the results'
          },
          personalize: {
            type: 'boolean',
            description: 'Whether to apply personalization filters',
            default: true
          }
        },
        required: ['category'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { category, filters = {}, sort_by = 'rating', personalize = true } = input;
        
        let products = this.getEnhancedProductData();

        // Apply category filter
        if (category !== 'any') {
          products = products.filter(p => p.type === category);
        }

        // Apply filters
        if (filters.price_range) {
          products = products.filter(p => {
            const price = p.sale_price_usd || p.retail_price_usd;
            return (!filters.price_range.min || price >= filters.price_range.min) &&
                   (!filters.price_range.max || price <= filters.price_range.max);
          });
        }

        if (filters.availability) {
          if (filters.availability === 'available') {
            products = products.filter(p => p.availability !== 'out_of_stock');
          } else {
            products = products.filter(p => p.availability === filters.availability);
          }
        }

        if (filters.rating_min) {
          products = products.filter(p => (p.rating || 0) >= filters.rating_min);
        }

        if (filters.on_sale) {
          products = products.filter(p => !!p.sale_price_usd);
        }

        // Apply personalization
        if (personalize && this.personalization.budgetRange) {
          products = products.filter(p => {
            const price = p.sale_price_usd || p.retail_price_usd;
            return price >= this.personalization.budgetRange!.min && 
                   price <= this.personalization.budgetRange!.max;
          });
        }

        // Sort products
        switch (sort_by) {
          case 'price_low':
            products.sort((a, b) => 
              (a.sale_price_usd || a.retail_price_usd) - (b.sale_price_usd || b.retail_price_usd)
            );
            break;
          case 'price_high':
            products.sort((a, b) => 
              (b.sale_price_usd || b.retail_price_usd) - (a.sale_price_usd || a.retail_price_usd)
            );
            break;
          case 'rating':
            products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            break;
          case 'discount':
            products.sort((a, b) => (b.sale_discount_pct || 0) - (a.sale_discount_pct || 0));
            break;
          case 'popularity':
            products.sort((a, b) => (b.reviews_count || 0) - (a.reviews_count || 0));
            break;
        }

        // Track analytics
        this.analytics.viewedProducts.push(...products.map(p => p.item_id));
        if (!this.analytics.categoryInterests.includes(category)) {
          this.analytics.categoryInterests.push(category);
        }
        this.analytics.lastActivity = Date.now();

        return {
          products: products.slice(0, 10), // Limit to top 10 results
          total_found: products.length,
          filters_applied: filters,
          personalization_applied: personalize,
          recommendations: this.generateRecommendations(products, category)
        };
      },
    });
  }

  /**
   * Enhanced cart management with analytics
   */
  private createEnhancedCartTool() {
    return tool({
      name: 'addToCartAdvanced',
      description: 'Enhanced cart management with size selection and analytics',
      parameters: {
        type: 'object',
        properties: {
          item_id: {
            type: 'string',
            description: 'Product ID to add to cart'
          },
          quantity: {
            type: 'number',
            minimum: 1,
            maximum: 10,
            default: 1
          },
          size_selection: {
            type: 'string',
            description: 'Selected size/length for the product'
          },
          personalization_notes: {
            type: 'string',
            description: 'Any special requests or notes'
          }
        },
        required: ['item_id'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { item_id, quantity = 1, size_selection, personalization_notes } = input;

        const products = this.getEnhancedProductData();
        const product = products.find(p => p.item_id === item_id);

        if (!product) {
          return {
            success: false,
            error: 'Product not found',
            suggested_alternatives: this.suggestAlternatives(item_id)
          };
        }

        if (product.availability === 'out_of_stock') {
          return {
            success: false,
            error: 'Product is out of stock',
            estimated_restock: '2-3 weeks',
            notify_when_available: true
          };
        }

        // Validate size selection if required
        if (product.specifications?.sizes || product.specifications?.length_options) {
          const availableSizes = product.specifications.sizes || product.specifications.length_options;
          if (size_selection && !availableSizes.includes(size_selection)) {
            return {
              success: false,
              error: 'Invalid size selection',
              available_sizes: availableSizes
            };
          }
        }

        // Track analytics
        this.analytics.cartAdditions.push(item_id);
        this.analytics.lastActivity = Date.now();

        const cartItem = {
          item_id,
          product_name: product.name,
          quantity,
          unit_price: product.sale_price_usd || product.retail_price_usd,
          total_price: (product.sale_price_usd || product.retail_price_usd) * quantity,
          size_selection,
          personalization_notes,
          added_at: new Date().toISOString()
        };

        return {
          success: true,
          cart_item: cartItem,
          cart_summary: {
            total_items: quantity,
            estimated_subtotal: cartItem.total_price,
            estimated_tax: cartItem.total_price * 0.08,
            estimated_shipping: cartItem.total_price > 100 ? 0 : 15
          },
          recommendations: this.generateComplementaryProducts(product)
        };
      },
    });
  }

  /**
   * Advanced checkout with enhanced features
   */
  private createAdvancedCheckoutTool() {
    return tool({
      name: 'checkoutAdvanced',
      description: 'Advanced checkout with payment options and shipping calculations',
      parameters: {
        type: 'object',
        properties: {
          cart_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item_id: { type: 'string' },
                quantity: { type: 'number' },
                size_selection: { type: 'string' }
              },
              required: ['item_id', 'quantity']
            }
          },
          phone_number: {
            type: 'string',
            pattern: '^\\(\\d{3}\\) \\d{3}-\\d{4}$'
          },
          shipping_preference: {
            type: 'string',
            enum: ['standard', 'expedited', 'overnight'],
            default: 'standard'
          },
          payment_method: {
            type: 'string',
            enum: ['credit_card', 'paypal', 'apple_pay', 'google_pay'],
            default: 'credit_card'
          },
          promo_code: {
            type: 'string',
            description: 'Optional promotional code'
          }
        },
        required: ['cart_items', 'phone_number'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { 
          cart_items, 
          phone_number, 
          shipping_preference = 'standard',
          payment_method = 'credit_card',
          promo_code 
        } = input;

        const products = this.getEnhancedProductData();
        let subtotal = 0;
        const processedItems: any[] = [];

        // Process each cart item
        for (const cartItem of cart_items) {
          const product = products.find(p => p.item_id === cartItem.item_id);
          if (!product) {
            return {
              success: false,
              error: `Product ${cartItem.item_id} not found`
            };
          }

          const itemPrice = product.sale_price_usd || product.retail_price_usd;
          const itemTotal = itemPrice * cartItem.quantity;
          subtotal += itemTotal;

          processedItems.push({
            ...cartItem,
            product_name: product.name,
            unit_price: itemPrice,
            total_price: itemTotal
          });
        }

        // Calculate shipping
        const shippingCosts = {
          standard: subtotal > 100 ? 0 : 15,
          expedited: subtotal > 200 ? 10 : 25,
          overnight: 45
        };
        const shipping = shippingCosts[shipping_preference as keyof typeof shippingCosts];

        // Apply promo code
        let discount = 0;
        if (promo_code) {
          const promoDiscounts: Record<string, number> = {
            'WELCOME10': 0.1,
            'SAVE20': 0.2,
            'FIRSTTIME': 0.15
          };
          discount = (promoDiscounts[promo_code] || 0) * subtotal;
        }

        const tax = (subtotal - discount) * 0.08;
        const total = subtotal - discount + tax + shipping;

        // Generate checkout session
        const checkoutSession = {
          session_id: `checkout_${Date.now()}`,
          items: processedItems,
          pricing: {
            subtotal,
            discount,
            tax,
            shipping,
            total
          },
          payment_method,
          shipping_preference,
          estimated_delivery: this.calculateDeliveryDate(shipping_preference),
          checkout_url: `https://snowypeakboards.com/checkout/${Date.now()}`
        };

        // Update analytics
        this.analytics.lastActivity = Date.now();

        return {
          success: true,
          checkout_session: checkoutSession,
          payment_options: ['credit_card', 'paypal', 'apple_pay', 'google_pay'],
          shipping_options: {
            standard: '5-7 business days',
            expedited: '2-3 business days',
            overnight: 'Next business day'
          }
        };
      },
    });
  }

  /**
   * Personalization tool for better recommendations
   */
  private createPersonalizationTool() {
    return tool({
      name: 'updatePersonalization',
      description: 'Update customer personalization preferences for better recommendations',
      parameters: {
        type: 'object',
        properties: {
          skill_level: {
            type: 'string',
            enum: ['beginner', 'intermediate', 'advanced', 'expert']
          },
          riding_style: {
            type: 'string',
            enum: ['freestyle', 'all-mountain', 'powder', 'carving']
          },
          budget_range: {
            type: 'object',
            properties: {
              min: { type: 'number', minimum: 0 },
              max: { type: 'number', minimum: 0 }
            }
          },
          preferred_brands: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { skill_level, riding_style, budget_range, preferred_brands } = input;

        // Update personalization data
        if (skill_level) this.personalization.skillLevel = skill_level;
        if (riding_style) this.personalization.ridingStyle = riding_style;
        if (budget_range) this.personalization.budgetRange = budget_range;
        if (preferred_brands) this.personalization.preferredBrands = preferred_brands;

        this.analytics.lastActivity = Date.now();

        return {
          success: true,
          message: 'Personalization preferences updated',
          current_preferences: this.personalization,
          personalized_recommendations: this.generatePersonalizedRecommendations()
        };
      },
    });
  }

  /**
   * Analytics tool for tracking customer behavior
   */
  private createAnalyticsTool() {
    return tool({
      name: 'getSalesAnalytics',
      description: 'Get analytics about customer behavior and preferences',
      parameters: {
        type: 'object',
        properties: {
          include_products: {
            type: 'boolean',
            description: 'Include detailed product interaction data',
            default: false
          }
        },
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { include_products = false } = input;

        const sessionDuration = Date.now() - this.analytics.sessionStartTime;
        const engagement = {
          session_duration_minutes: Math.round(sessionDuration / 60000),
          products_viewed: this.analytics.viewedProducts.length,
          unique_products_viewed: new Set(this.analytics.viewedProducts).size,
          cart_additions: this.analytics.cartAdditions.length,
          categories_explored: this.analytics.categoryInterests.length,
          price_comparisons: this.analytics.priceComparisons,
          last_activity: new Date(this.analytics.lastActivity).toISOString()
        };

        const result: any = {
          engagement,
          personalization_status: {
            has_skill_level: !!this.personalization.skillLevel,
            has_riding_style: !!this.personalization.ridingStyle,
            has_budget_range: !!this.personalization.budgetRange,
            has_brand_preferences: !!this.personalization.preferredBrands?.length
          }
        };

        if (include_products) {
          result.product_interactions = {
            viewed_products: this.analytics.viewedProducts,
            cart_additions: this.analytics.cartAdditions,
            category_interests: this.analytics.categoryInterests
          };
        }

        return result;
      },
    });
  }

  /**
   * Generate product recommendations based on category
   */
  private generateRecommendations(products: Product[], category: string): string[] {
    if (category === 'snowboard') {
      return ['Consider matching boots and bindings', 'Check out our helmet collection for safety'];
    }
    if (category === 'boots') {
      return ['Pair with professional snowboards', 'Add custom insoles for comfort'];
    }
    return ['Complete your setup with accessories', 'Check seasonal maintenance kits'];
  }

  /**
   * Generate complementary products for cart items
   */
  private generateComplementaryProducts(product: Product): string[] {
    const complements: Record<string, string[]> = {
      snowboard: ['boots', 'bindings', 'wax', 'edge tune'],
      boots: ['custom insoles', 'boot warmer', 'replacement laces'],
      apparel: ['base layers', 'gloves', 'helmet', 'goggles']
    };
    return complements[product.type] || [];
  }

  /**
   * Suggest alternative products
   */
  private suggestAlternatives(itemId: string): string[] {
    // In a real implementation, this would use ML to find similar products
    return ['Similar products in the same category', 'Customer favorites', 'Recently viewed items'];
  }

  /**
   * Calculate delivery date based on shipping preference
   */
  private calculateDeliveryDate(preference: string): string {
    const today = new Date();
    const daysToAdd = {
      standard: 7,
      expedited: 3,
      overnight: 1
    }[preference] || 7;

    const deliveryDate = new Date(today.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return deliveryDate.toISOString().split('T')[0];
  }

  /**
   * Generate personalized recommendations
   */
  private generatePersonalizedRecommendations(): any[] {
    const products = this.getEnhancedProductData();
    return products
      .filter(p => {
        if (this.personalization.budgetRange) {
          const price = p.sale_price_usd || p.retail_price_usd;
          return price >= this.personalization.budgetRange.min && 
                 price <= this.personalization.budgetRange.max;
        }
        return true;
      })
      .slice(0, 5);
  }

  /**
   * Create the enhanced sales agent
   */
  createAgent(availableAgents: RealtimeAgent[] = []): RealtimeAgent {
    const { tools: handoffTools } = createHandoffTools(availableAgents);

    return new RealtimeAgent({
      name: 'enhancedSalesAgent',
      voice: 'sage',
      handoffDescription: 'Enhanced sales agent with personalization, advanced analytics, and comprehensive product management',
      instructions: `
# Enhanced Sales Agent

You are an advanced sales specialist for Snowy Peak Boards with cutting-edge personalization and analytics capabilities.

## Enhanced Capabilities
- **Personalized Recommendations**: Tailor suggestions based on skill level, riding style, and budget
- **Advanced Product Filtering**: Multi-dimensional search with price, rating, availability filters
- **Smart Analytics**: Track customer behavior and preferences for better service
- **Comprehensive Cart Management**: Size selection, inventory validation, complementary products
- **Enhanced Checkout**: Multiple payment methods, shipping options, promo codes

## Key Features
1. **Intelligent Product Discovery**: Help customers find exactly what they need
2. **Personalization Engine**: Learn preferences and adapt recommendations
3. **Advanced Filtering**: Price range, ratings, availability, sales status
4. **Smart Cart Management**: Size validation, inventory checks, recommendations
5. **Comprehensive Checkout**: Payment options, shipping calculations, delivery estimates

## Sales Process
1. **Discovery**: Understand customer needs and preferences
2. **Personalization**: Collect skill level, riding style, budget information
3. **Product Presentation**: Show relevant products with advanced filtering
4. **Recommendation**: Suggest complementary items and alternatives
5. **Cart Management**: Handle size selection and inventory validation
6. **Checkout**: Process orders with multiple payment and shipping options

## Analytics & Insights
- Track product views and category interests
- Monitor cart behavior and conversion patterns
- Analyze price sensitivity and budget preferences
- Measure engagement and session quality

## Customer Experience
- **Consultative Approach**: Ask questions to understand needs
- **Educational Content**: Explain product features and benefits
- **Transparent Pricing**: Show discounts, taxes, shipping clearly
- **Smooth Process**: Guide through each step with clear information

Remember to be enthusiastic about snowboarding while maintaining professionalism. Use your enhanced tools to provide the best possible shopping experience.
`,
      tools: [
        this.createAdvancedProductLookupTool(),
        this.createEnhancedCartTool(),
        this.createAdvancedCheckoutTool(),
        this.createPersonalizationTool(),
        this.createAnalyticsTool(),
        ...handoffTools
      ],
      handoffs: []
    });
  }

  /**
   * Reset analytics data
   */
  resetAnalytics(): void {
    this.analytics = {
      viewedProducts: [],
      cartAdditions: [],
      priceComparisons: 0,
      categoryInterests: [],
      sessionStartTime: Date.now(),
      lastActivity: Date.now()
    };
  }

  /**
   * Get current analytics
   */
  getAnalytics(): SalesAnalytics {
    return { ...this.analytics };
  }

  /**
   * Get personalization data
   */
  getPersonalization(): PersonalizationData {
    return { ...this.personalization };
  }

  /**
   * Get agent metadata
   */
  getMetadata(): AgentMetadata {
    return { ...this.metadata };
  }
}

// Export factory function
export const createEnhancedSalesAgent = (availableAgents: RealtimeAgent[] = []) => {
  const enhancedSales = new EnhancedSalesAgent();
  return enhancedSales.createAgent(availableAgents);
};

// Export the class for advanced usage
export { EnhancedSalesAgent };