import { VisionAnalysisResult } from './types';
import { getOpenAIClient } from '../openai/client';

export async function analyzeImage(
  file: File,
  customPrompt?: string
): Promise<VisionAnalysisResult> {
  const client = getOpenAIClient();
  
  // Convert file to base64
  const base64 = await fileToBase64(file);
  
  const systemPrompt = `You are an expert image analyst. Analyze the provided image and return a JSON response with the following structure:
{
  "description": "detailed description of what you see",
  "confidence": number between 0 and 1
}`;

  const userPrompt = customPrompt || 'Analyze this image and provide a detailed description.';

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${file.type};base64,${base64}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content received');
    }

    const result = JSON.parse(content);
    return {
      description: result.description || 'No description available',
      confidence: result.confidence || 0,
      equipmentType: result.equipmentType,
      condition: result.condition,
      issues: result.issues,
      recommendations: result.recommendations,
      extractedText: result.extractedText
    };
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
}

export async function analyzeEquipmentImage(file: File): Promise<VisionAnalysisResult> {
  const equipmentPrompt = `Analyze this equipment image and provide a detailed assessment. Focus on:
1. Equipment type and identification
2. Overall condition (excellent, good, fair, poor)
3. Visible issues or damage
4. Maintenance recommendations
5. Safety concerns if any

Return your analysis in this JSON format:
{
  "description": "detailed description",
  "equipmentType": "type of equipment",
  "condition": "excellent|good|fair|poor",
  "issues": ["list of issues"],
  "recommendations": ["maintenance recommendations"],
  "confidence": number between 0 and 1
}`;

  return analyzeImage(file, equipmentPrompt);
}

export async function extractTextFromImage(file: File): Promise<VisionAnalysisResult> {
  const textPrompt = `Extract all readable text from this image. Focus on:
1. Technical specifications
2. Labels and markings
3. Serial numbers or model numbers
4. Warning signs or instructions
5. Any other visible text

Return your analysis in this JSON format:
{
  "description": "description of the image",
  "extractedText": "all extracted text",
  "confidence": number between 0 and 1
}`;

  return analyzeImage(file, textPrompt);
}

export async function analyzeImageBatch(files: File[]): Promise<VisionAnalysisResult[]> {
  const results: VisionAnalysisResult[] = [];
  
  for (const file of files) {
    try {
      const result = await analyzeImage(file);
      results.push(result);
    } catch (error) {
      console.error(`Error analyzing image ${file.name}:`, error);
      // Add error result to maintain array length
      results.push({
        description: 'Failed to analyze image',
        confidence: 0,
        equipmentType: 'unknown',
        condition: 'unknown'
      });
    }
  }
  
  return results;
}

export async function analyzeImageWithContext(
  file: File,
  context: {
    equipmentType?: string;
    previousAnalysis?: VisionAnalysisResult;
    location?: string;
    maintenanceHistory?: string[];
  }
): Promise<VisionAnalysisResult> {
  let contextPrompt = 'Analyze this image';
  
  if (context.equipmentType) {
    contextPrompt += ` of a ${context.equipmentType}`;
  }
  
  if (context.location) {
    contextPrompt += ` located in ${context.location}`;
  }
  
  if (context.previousAnalysis) {
    contextPrompt += `. Previous analysis noted: ${context.previousAnalysis.description}`;
  }
  
  if (context.maintenanceHistory && context.maintenanceHistory.length > 0) {
    contextPrompt += `. Maintenance history: ${context.maintenanceHistory.join(', ')}`;
  }
  
  contextPrompt += `. Provide a detailed analysis focusing on any changes or new observations.`;
  
  return analyzeImage(file, contextPrompt);
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get just the base64 string
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function formatAnalysisForChat(analysis: VisionAnalysisResult): string {
  let formatted = `**Image Analysis:**\n${analysis.description}\n\n`;
  
  if (analysis.equipmentType) {
    formatted += `**Equipment Type:** ${analysis.equipmentType}\n`;
  }
  
  if (analysis.condition) {
    formatted += `**Condition:** ${analysis.condition}\n`;
  }
  
  if (analysis.issues && analysis.issues.length > 0) {
    formatted += `**Issues Identified:**\n${analysis.issues.map(issue => `• ${issue}`).join('\n')}\n\n`;
  }
  
  if (analysis.recommendations && analysis.recommendations.length > 0) {
    formatted += `**Recommendations:**\n${analysis.recommendations.map(rec => `• ${rec}`).join('\n')}\n\n`;
  }
  
  if (analysis.extractedText) {
    formatted += `**Extracted Text:**\n${analysis.extractedText}\n\n`;
  }
  
  formatted += `**Confidence:** ${Math.round(analysis.confidence * 100)}%`;
  
  return formatted;
}