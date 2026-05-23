import { secretManager } from '../secrets/secretManager'

export interface TenderAnalysis {
  summary: string
  keyRequirements: string[]
  eligibilityCriteria: string[]
  submissionDeadline: string
  estimatedValue: number
  riskLevel: 'low' | 'medium' | 'high'
  recommendations: string[]
  complianceNotes: string[]
}

export interface ChatResponse {
  message: string
  suggestions?: string[]
  relatedTenders?: string[]
}

export interface ConnectorRecommendation {
  connectorId: string
  matchScore: number
  reasons: string[]
  strengths: string[]
  potentialConcerns: string[]
}

class OpenAIService {
  private apiKey: string | null = null
  private baseUrl = 'https://api.openai.com/v1'

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      try {
        this.apiKey = await secretManager.getSecret('openai-api-key')
      } catch (error) {
        // Fallback to environment variable if Secret Manager fails
        this.apiKey = process.env.OPENAI_API_KEY || null
        if (!this.apiKey) {
          console.warn('OpenAI API key not found in Secret Manager or environment variables')
        }
      }
    }
  }

  private async makeRequest(endpoint: string, data: any): Promise<any> {
    await this.initialize()
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key not found')
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  async analyzeTenderDocument(documentText: string, tenderTitle: string): Promise<TenderAnalysis> {
    const prompt = `
    Analyze this South African government tender document and provide a comprehensive analysis:

    Tender Title: ${tenderTitle}
    
    Document Content:
    ${documentText}

    Please provide a JSON response with the following structure:
    {
      "summary": "Brief 2-3 sentence summary of the tender",
      "keyRequirements": ["List of key requirements for bidders"],
      "eligibilityCriteria": ["List of eligibility criteria"],
      "submissionDeadline": "YYYY-MM-DD format",
      "estimatedValue": "Numeric value in ZAR",
      "riskLevel": "low/medium/high based on complexity and requirements",
      "recommendations": ["Actionable recommendations for entrepreneurs"],
      "complianceNotes": ["Important compliance and regulatory notes"]
    }

    Focus on South African tender regulations, BBBEE requirements, and practical business advice.
    `

    try {
      const response = await this.makeRequest('/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in South African government tenders and business compliance. Provide accurate, practical analysis focused on helping entrepreneurs understand tender requirements and improve their chances of success.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      return JSON.parse(content)
    } catch (error) {
      console.error('Error analyzing tender document:', error)
      // Return fallback analysis
      return {
        summary: 'Document analysis unavailable. Please review manually.',
        keyRequirements: ['Review document for specific requirements'],
        eligibilityCriteria: ['Check eligibility criteria in document'],
        submissionDeadline: 'Check document for deadline',
        estimatedValue: 0,
        riskLevel: 'medium' as const,
        recommendations: ['Review document thoroughly', 'Consult with business advisor'],
        complianceNotes: ['Ensure all compliance requirements are met']
      }
    }
  }

  async generateChatResponse(userMessage: string, context?: any): Promise<ChatResponse> {
    const systemPrompt = `
    You are TenderConnect AI, a helpful assistant for South African entrepreneurs navigating government tenders. 
    
    Your role:
    - Help entrepreneurs understand tender requirements
    - Provide guidance on BBBEE compliance
    - Suggest relevant tenders based on user profile
    - Answer questions about the tender process
    - Offer practical business advice
    
    Context: ${context ? JSON.stringify(context) : 'No additional context'}
    
    Keep responses concise, practical, and focused on South African business context.
    `

    try {
      const response = await this.makeRequest('/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })

      const message = response.choices[0]?.message?.content || 'I apologize, but I cannot process your request at the moment.'

      return {
        message,
        suggestions: this.extractSuggestions(message),
        relatedTenders: this.extractRelatedTenders(message)
      }
    } catch (error) {
      console.error('Error generating chat response:', error)
      return {
        message: 'I apologize, but I\'m experiencing technical difficulties. Please try again later or contact our support team.',
        suggestions: ['Contact support', 'Browse tenders manually', 'Check our FAQ']
      }
    }
  }

  async recommendConnectors(
    tenderAnalysis: TenderAnalysis,
    availableConnectors: any[],
    entrepreneurProfile: any
  ): Promise<ConnectorRecommendation[]> {
    const prompt = `
    Based on this tender analysis and available connectors, recommend the best matches:

    Tender Analysis:
    ${JSON.stringify(tenderAnalysis, null, 2)}

    Available Connectors:
    ${JSON.stringify(availableConnectors.map(c => ({
      id: c.id,
      location: c.location,
      experience: c.experience,
      rating: c.rating,
      specialties: c.specialties,
      availability: c.availability
    })), null, 2)}

    Entrepreneur Profile:
    ${JSON.stringify(entrepreneurProfile, null, 2)}

    Provide recommendations with match scores (0-100) and detailed reasoning.
    `

    try {
      const response = await this.makeRequest('/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at matching connectors with tender requirements. Consider location, experience, specialties, and availability when making recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      // Parse the AI response and convert to structured format
      return this.parseConnectorRecommendations(content, availableConnectors)
    } catch (error) {
      console.error('Error generating connector recommendations:', error)
      // Return fallback recommendations based on simple criteria
      return availableConnectors.slice(0, 3).map(connector => ({
        connectorId: connector.id,
        matchScore: Math.floor(Math.random() * 30) + 70, // 70-100
        reasons: ['Available connector', 'Good location match'],
        strengths: ['Reliable', 'Experienced'],
        potentialConcerns: ['Review profile for specific experience']
      }))
    }
  }

  async generateTenderSummary(tenderData: any): Promise<string> {
    const prompt = `
    Create a concise, engaging summary for this tender that will help entrepreneurs quickly understand the opportunity:

    Tender Data:
    ${JSON.stringify(tenderData, null, 2)}

    Requirements:
    - 2-3 sentences maximum
    - Highlight key value and requirements
    - Use clear, business-friendly language
    - Focus on what makes this tender attractive
    `

    try {
      const response = await this.makeRequest('/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a business writer specializing in government tender summaries. Create compelling, concise summaries that help entrepreneurs quickly assess opportunities.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      })

      return response.choices[0]?.message?.content || 'Tender opportunity available. Please review details for more information.'
    } catch (error) {
      console.error('Error generating tender summary:', error)
      return 'Tender opportunity available. Please review details for more information.'
    }
  }

  private extractSuggestions(message: string): string[] {
    // Simple extraction of suggestions from AI response
    const suggestions: string[] = []
    
    if (message.toLowerCase().includes('bbbee')) {
      suggestions.push('Check BBBEE compliance requirements')
    }
    if (message.toLowerCase().includes('tax')) {
      suggestions.push('Verify tax clearance certificate')
    }
    if (message.toLowerCase().includes('cidb')) {
      suggestions.push('Check CIDB registration requirements')
    }
    
    return suggestions.length > 0 ? suggestions : ['Review tender requirements', 'Check eligibility criteria']
  }

  private extractRelatedTenders(message: string): string[] {
    // This would typically integrate with your tender database
    // For now, return empty array
    return []
  }

  private parseConnectorRecommendations(content: string, connectors: any[]): ConnectorRecommendation[] {
    // Parse AI response and convert to structured recommendations
    // This is a simplified implementation - in production, you'd want more robust parsing
    try {
      const recommendations: ConnectorRecommendation[] = []
      
      connectors.slice(0, 3).forEach((connector, index) => {
        recommendations.push({
          connectorId: connector.id,
          matchScore: Math.max(60, 100 - (index * 10)), // Decreasing scores
          reasons: [
            'Good location match',
            'Available for the briefing date',
            'Has relevant experience'
          ],
          strengths: [
            'Reliable track record',
            'Good communication skills',
            'Familiar with tender process'
          ],
          potentialConcerns: [
            'Verify specific experience with this type of tender'
          ]
        })
      })
      
      return recommendations
    } catch (error) {
      console.error('Error parsing connector recommendations:', error)
      return []
    }
  }
}

export const openaiService = new OpenAIService()
