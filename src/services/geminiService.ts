import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || process.env.USER_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export interface StoryState {
  childName: string;
  gender: 'boy' | 'girl' | 'unknown';
  heroName: string;
  heroType: string;
  friendName: string;
  location: string;
  paragraphs: string[];
  currentParagraphIndex: number;
}

export const detectGender = async (name: string): Promise<'boy' | 'girl' | 'unknown'> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Определи пол ребенка по имени: "${name}". 
      ПРАВИЛА:
      - В русском языке имена на -а, -я (Мария, Елена, Алиса) чаще женские.
      - Имена на согласную или мягкий знак (Иван, Игорь, Артем) чаще мужские.
      - Если имя уменьшительно-ласкательное (Леночка, Ванюша, Сашуля), определи пол по корню.
      - Если имя универсальное (Саша, Женя, Валя) без уточнения фамилии — ответь UNKNOWN.
      - Ответь ТОЛЬКО одним английским словом: BOY, GIRL или UNKNOWN.`,
    });
    
    const text = (response.text || "").toUpperCase();
    if (text.includes("BOY")) return "boy";
    if (text.includes("GIRL")) return "girl";
    return "unknown";
  } catch (error) {
    console.error("Gender Detection Error:", error);
    return "unknown";
  }
};

export const generateBuklikResponse = async (prompt: string, context: string = "") => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: `ТЫ — БУКЛИК, ВОЛШЕБНЫЙ ПОМОЩНИК.
        Ты добрый друг для ребенка 5-7 лет. 
        ПРАВИЛА:
        1. Обращайся по имени. 
        2. Используй простые слова. 
        3. Хвали и не критикуй.
        4. Пиши грамотно, соблюдай падежи.
        5. НЕ ИСПОЛЬЗУЙ эмодзи или спецсимволы в тексте.
        ${context}`,
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Buklik Response Error:", error);
    return "Я здесь, дружок! Давай продолжим.";
  }
};

export const generateStoryParagraph = async (state: StoryState, userIdea: string = "", isFinal: boolean = false) => {
  try {
    const prompt = `Напиши ${isFinal ? 'ПОСЛЕДНИЙ (финальный)' : 'СЛЕДУЮЩИЙ'} абзац волшебной сказки (строго 3-5 предложений).
    
    ОБЯЗАТЕЛЬНЫЕ ГЕРОИ:
    - ГЛАВНЫЙ ГЕРОЙ: ${state.heroName} (это ${state.heroType}).
    - ДРУГ ГЕРОЯ: ${state.friendName}.
    
    ОКРУЖЕНИЕ:
    - МЕСТО: ${state.location}.
    
    КОНТЕКСТ СЮЖЕТА:
    - Что уже было: ${state.paragraphs.length > 0 ? state.paragraphs.join(" ") : "Начало сказки."}
    - Последнее событие: ${state.paragraphs.length > 0 ? state.paragraphs[state.paragraphs.length - 1] : "Герои только что встретились."}
    - Что должно быть дальше: ${userIdea || 'Герои продолжают путь.'}
    
    ПРАВИЛА СТИЛЯ И ГРАММАТИКИ:
    1. ХУДОЖЕСТВЕННОЕ НАЧАЛО: Если это первый абзац, начни с красивого описания природы или атмосферы (метафоры, эпитеты, волшебная завязка). Не начинай со слов "Жил-был" или "Однажды".
    2. ГАРМОНИЧНЫЙ ПЕРЕХОД: Новый абзац должен ПЛАВНО и логично вытекать из предыдущего. Используй связующие слова ("И вот тогда...", "Вдруг впереди...", "Продолжив свой путь...").
    3. РЕГИСТР ИМЕН: ГЕРОЙ (${state.heroName}), ДРУГ (${state.friendName}) и МЕСТО (${state.location}) должны писаться со СТРОЧНОЙ (маленькой) буквы, если они находятся внутри предложения. Используй заглавную букву ТОЛЬКО если это начало предложения. (Например: "маленький котенок пошел...", "в волшебном лесу было тихо..."). 
    4. МОРАЛЬ И ВОСПИТАНИЕ: Сказка ОБЯЗАТЕЛЬНО должна содержать воспитательный подтекст: учить уважать старших, помогать тем, кто в беде, показывать, что доброта побеждает зло. Сюжет должен иметь смысл и логику.
    5. ДЛИНА: Абзац должен состоять СТРОГО из 3-5 содержательных предложений. Это важно для того, чтобы текст поместился на страницу.
    
    ДОПОЛНИТЕЛЬНО:
    6. Согласование по родам: герой ${state.gender === 'girl' ? 'девочка/женщина' : 'мальчик/мужчина'} -> используй соответствующие окончания ("пошла", "увидела" vs "пошёл", "увидел").
    7. ЗАПРЕЩЕНО использовать: "Жил-был", "Жила-была", "Однажды". 
    8. Пиши на русском языке.
    ${isFinal ? '9. ОБЯЗАТЕЛЬНО сделай счастливый, законченный и очень красивый ФИНАЛ. Подведи итог морали всей истории.' : '10. Описывай одно значимое событие за раз, не торопись.'}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    if (!response.text || response.text.length < 10) {
       throw new Error("Empty or too short story paragraph");
    }
    
    return response.text;
  } catch (error) {
    console.error("Story Paragraph Error:", error);
    return `${state.heroName} и ${state.friendName} вместе отправились навстречу приключениям в ${state.location}!`;
  }
};

/**
 * Generates 3 possible next steps for the story based on current state.
 */
export async function generateStoryBranches(state: StoryState): Promise<string[]> {
  try {
    const prompt = `
    Ты - помощник сказочника. У нас есть текущая сказка:
    ГЕРОЙ: ${state.heroName} (${state.heroType})
    МЕСТО: ${state.location}
    ДРУГ: ${state.friendName}
    ПОСЛЕДНЕЕ СОБЫТИЕ: ${state.paragraphs[state.paragraphs.length - 1]}

    Задание: Придумай 3 ОЧЕНЬ КОРОТКИХ варианта (3-5 слов каждый), что может случиться дальше. 
    Варианты должны быть интересными, логичными и обязательно вести к какому-то доброму уроку.
    Ответь ТОЛЬКО списком из 3 строк, без смайликов и звездочек.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    const text = response.text || "";
    return text.split("\n")
      .map(s => s.replace(/^\d+\.\s*/, "").replace(/^[-*]\s*/, "").trim())
      .filter(s => s.length > 0 && s.length < 100)
      .slice(0, 3);
  } catch (error) {
    console.error("Branches Gen Error:", error);
    return ['Нашли волшебный клад', 'Встретили доброго волшебника', 'Спасли друга из беды'];
  }
}

export const speakText = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Скажи весело и по-доброму: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Zephyr" },
          },
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.mimeType?.includes("audio"));
    if (!audioPart?.inlineData?.data) {
      console.warn("No audio data returned from Gemini");
      return null;
    }
    
    const data = audioPart.inlineData.data;
    const mime = audioPart.inlineData.mimeType || "audio/wav";
    return `data:${mime};base64,${data}`;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
};

export const generateStoryImage = async (state: StoryState, paragraph: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image", 
      contents: {
        parts: [{ 
          text: `Professional high-quality children's book illustration for a specific scene in a magic fairy tale.
          
          CHARACTERS:
          - Main Hero: ${state.heroName} (a ${state.heroType}), beautifully drawn, friendly look.
          - Companion/Friend: ${state.friendName}, neat, cute appearance.
          
          ENVIRONMENT: ${state.location}, whimsical and spacious magic background.
          
          SCENE DESCRIPTION: "${paragraph}".
          
          VISUAL STYLE: 
          - Charming digital drawing for safe toddler storybook, warm gentle colors, lovely lighting.
          - Perfect proportion, neat shapes, details are clear and well organized (no extra limbs, no overlapping faces, no duplicate details).
          - Clean composition, spacious background so details are spaced and do not overlap.
          - ABSOLUTELY NO text, letters, symbols, words, or signatures inside the illustration.` 
        }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });
    
    const candidates = response.candidates || [];
    if (candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.mimeType.includes("image")) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return await generatePollinationsImage(state, paragraph);
  } catch (error) {
    console.error("Gemini Image Gen Error, trying Pollinations fallback:", error);
    return await generatePollinationsImage(state, paragraph);
  }
};

const generatePollinationsImage = async (state: StoryState, paragraph: string) => {
  try {
    const imgPrompt = `Professional children's book illustration: ${state.heroType} ${state.heroName} and ${state.friendName} in ${state.location}. Scene: ${paragraph.substring(0, 100)}. Whimsical, magical atmosphere.`;
    const response = await fetch(`/api/generate-image?prompt=${encodeURIComponent(imgPrompt)}`);
    if (!response.ok) throw new Error(`Pollinations proxy responded with ${response.status}`);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Pollinations Fallback Error:", err);
    return null;
  }
};

export const evaluateReading = async (audioBase64: string, expectedText: string, mimeType: string = "audio/webm") => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: audioBase64,
          },
        },
        {
          text: `ЗАДАНИЕ: Послушай, как ребенок читает этот текст: "${expectedText}". 
          КРИТЕРИИ ОЦЕНКИ (МАКСИМАЛЬНО СТРОГО):
          1. Если на записи ТИШИНА, шум ветра, стук, шуршание или просто фоновые звуки БЕЗ четкого человеческого голоса — ответь СТРОГО RETRY.
          2. Если слышен голос, который ПЫТАЕТСЯ прочитать слова из текста (даже если с ошибками, медленно или неразборчиво) — ответь SUCCESS.
          3. Если запись слишком короткая (меньше 1.5 секунд) — ответь RETRY.
          4. Если ребенок просто нажал кнопку и молчит или смеется/кричит не по тексту — ответь RETRY.
          
          ВАЖНО: Картинка — это награда за чтение. Нет чтения — нет картинки и нет похвалы. 
          Ответь ТОЛЬКО одним словом: SUCCESS или RETRY.`,
        },
      ],
    });
    const text = (response.text || "").toUpperCase();
    if (text.includes("SUCCESS")) return "SUCCESS";
    if (text.includes("RETRY")) return "RETRY";
    return "RETRY"; // Default to retry if unclear, to encourage another try
  } catch (error) {
    console.error("Evaluation Error:", error);
    return "RETRY";
  }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string = "audio/webm"): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: audioBase64,
          },
        },
        {
          text: "Переведи это аудио в текст. Напиши только сам ответ одним-двумя словами.",
        },
      ],
    });
    return (response.text || "").replace(/[.!?]/g, "").trim();
  } catch (error) {
    console.error("Transcription Error:", error);
    return "";
  }
};
