// src/utils/aiService.js

/**
 * AI Service for generating orientation scripts, test questions, and recording guidance
 * 
 * This service integrates with OpenAI API to generate:
 * - Test questions based on category and requirements
 * - Orientation scripts with location-based recording guidance
 * - Recording guidance for equipment and restaurant areas
 */

const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Generate test questions using AI
 */
export async function generateTestQuestions({
  category,
  testName,
  numberOfQuestions = 10,
  difficulty = "medium",
  restaurantType = "restaurant",
  customContext = "",
}) {
  if (!OPENAI_API_KEY) {
    console.warn("OpenAI API key not configured. Using mock data.");
    return generateMockQuestions(numberOfQuestions);
  }

  const prompt = `You are an expert in creating training tests for restaurant staff. Generate ${numberOfQuestions} multiple-choice questions for a test called "${testName}" in the category "${category}".

Requirements:
- Difficulty level: ${difficulty}
- Restaurant type: ${restaurantType}
- Each question should have 4 answer options
- Mark the correct answer clearly
- Questions should be practical and relevant to daily operations
${customContext ? `- Additional context: ${customContext}` : ""}

Return the questions in JSON format:
{
  "questions": [
    {
      "question": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of the correct answer"
    }
  ]
}`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are an expert in restaurant training and education. Generate high-quality, practical test questions.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.questions.map((q, idx) => ({
        id: Date.now() + idx,
        question: q.question,
        type: "multiple_choice",
        options: q.options,
        correctAnswer: q.correctAnswer,
        points: 1,
        explanation: q.explanation,
      }));
    }

    throw new Error("Failed to parse AI response");
  } catch (error) {
    console.error("AI test generation error:", error);
    // Fallback to mock data
    return generateMockQuestions(numberOfQuestions);
  }
}

/**
 * Generate orientation script with recording guidance
 */
export async function generateOrientationScript({
  department, // FOH | BOH
  tone = "Professional",
  emphasis = "Guest experience",
  duration = 15,
  restaurantType = "restaurant",
  includeRecordingGuidance = true,
}) {
  if (!OPENAI_API_KEY) {
    console.warn("OpenAI API key not configured. Using mock script.");
    return generateMockScript(department);
  }

  const deptContext =
    department === "FOH"
      ? "Front of House staff (servers, hosts, bartenders) focusing on guest service, menu knowledge, and customer interaction"
      : "Back of House staff (cooks, prep, dishwashers) focusing on food preparation, safety, and kitchen operations";

  const prompt = `Create a comprehensive orientation script for ${deptContext} in a ${restaurantType}.

Requirements:
- Tone: ${tone}
- Emphasis: ${emphasis}
- Duration: approximately ${duration} minutes
- Include practical, hands-on guidance
- Make it engaging and easy to follow

${includeRecordingGuidance ? `IMPORTANT: Include specific recording guidance for:
- Equipment demonstrations (coffee machines, POS systems, kitchen equipment, etc.)
- Location-based recordings (dining area, kitchen stations, bar area, etc.)
- Step-by-step instructions that can be filmed
- Visual demonstrations that would be helpful` : ""}

Return the script in JSON format:
{
  "title": "Orientation Title",
  "sections": [
    {
      "title": "Section Title",
      "content": "Script content here...",
      "duration": 3,
      "recordingGuidance": {
        "location": "Where to record",
        "equipment": ["Equipment to show"],
        "keyPoints": ["Key visual points to demonstrate"],
        "script": "What to say while recording"
      }
    }
  ],
  "totalDuration": ${duration}
}`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are an expert in creating restaurant training materials. Create detailed, practical orientation scripts with recording guidance.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error("Failed to parse AI response");
  } catch (error) {
    console.error("AI script generation error:", error);
    return generateMockScript(department);
  }
}

/**
 * Generate recording guidance for specific equipment/locations
 */
export async function generateRecordingGuidance({
  equipment,
  location,
  department,
  purpose = "training",
}) {
  if (!OPENAI_API_KEY) {
    return generateMockRecordingGuidance(equipment, location);
  }

  const prompt = `Create detailed recording guidance for filming a ${purpose} video about "${equipment}" in the "${location}" area for ${department === "FOH" ? "Front of House" : "Back of House"} staff.

Include:
- Best camera angles
- Key steps to demonstrate
- What to say/narrate
- Common mistakes to avoid
- Safety considerations
- Duration estimate

Return in JSON format:
{
  "equipment": "${equipment}",
  "location": "${location}",
  "guidance": {
    "cameraAngles": ["Angle 1", "Angle 2"],
    "steps": [
      {
        "step": 1,
        "action": "What to do",
        "narration": "What to say",
        "duration": 30
      }
    ],
    "keyPoints": ["Point 1", "Point 2"],
    "commonMistakes": ["Mistake 1", "Mistake 2"],
    "safetyNotes": ["Note 1", "Note 2"],
    "estimatedDuration": 5
  }
}`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are an expert in creating video production guidance for restaurant training videos.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error("Failed to parse AI response");
  } catch (error) {
    console.error("AI recording guidance error:", error);
    return generateMockRecordingGuidance(equipment, location);
  }
}

// ================= MOCK DATA (Fallback) =================

function generateMockQuestions(count) {
  const questions = [];
  for (let i = 0; i < count; i++) {
    questions.push({
      id: Date.now() + i,
      question: `Sample question ${i + 1}?`,
      type: "multiple_choice",
      options: [
        "Correct answer",
        "Incorrect option 1",
        "Incorrect option 2",
        "Incorrect option 3",
      ],
      correctAnswer: 0,
      points: 1,
      explanation: "This is the correct answer because...",
    });
  }
  return questions;
}

function generateMockScript(department) {
  return {
    title: `${department} Orientation Script`,
    sections: [
      {
        title: "Welcome & Introduction",
        content: "Welcome to our restaurant team! Today we'll cover...",
        duration: 2,
        recordingGuidance: {
          location: "Main entrance or office",
          equipment: [],
          keyPoints: ["Welcome message", "Team introduction"],
          script: "Welcome to [Restaurant Name]. I'm [Name] and I'll be guiding you through your orientation today.",
        },
      },
      {
        title: department === "FOH" ? "POS System Training" : "Kitchen Safety",
        content: department === "FOH" 
          ? "Let's learn how to use our POS system..." 
          : "Kitchen safety is our top priority...",
        duration: 5,
        recordingGuidance: {
          location: department === "FOH" ? "Front counter" : "Kitchen",
          equipment: department === "FOH" ? ["POS System"] : ["Fire extinguisher", "First aid kit"],
          keyPoints: ["Step-by-step demonstration", "Common mistakes"],
          script: department === "FOH"
            ? "Here's how to process an order on our POS system..."
            : "Always check the fire extinguisher location and know where the first aid kit is...",
        },
      },
    ],
    totalDuration: 15,
  };
}

function generateMockRecordingGuidance(equipment, location) {
  return {
    equipment,
    location,
    guidance: {
      cameraAngles: ["Front view", "Side view", "Close-up of controls"],
      steps: [
        {
          step: 1,
          action: "Show equipment overview",
          narration: "This is the [equipment]. It's located in [location].",
          duration: 30,
        },
        {
          step: 2,
          action: "Demonstrate basic operation",
          narration: "To use this, first...",
          duration: 60,
        },
      ],
      keyPoints: ["Safety first", "Proper technique", "Common mistakes"],
      commonMistakes: ["Rushing", "Not following safety protocols"],
      safetyNotes: ["Always check equipment before use", "Report any issues immediately"],
      estimatedDuration: 5,
    },
  };
}