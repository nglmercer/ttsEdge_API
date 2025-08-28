import { EdgeTTS,type Voice,type SynthesisOptions } from '@andresaya/edge-tts';
import { DataStorage } from "json-obj-manager";
import { JSONFileAdapter } from "json-obj-manager/node";
import { SpamCleaner, createCleaner, quickClean } from "../filters/spam-cleaner"
import path from "path";

interface ttsOptions {
    ttsprovider: string
    voice:string;
    options:SynthesisOptions;
}
export const TTS_Config:ttsOptions = {
   ttsprovider:'ttsEdge',
   voice: 'es-PE-CamilaNeural',
   options: {

   }
}
const tempPath = path.join(process.cwd(),'temp')
const voiceStorage = new DataStorage<Voice[]>(
    new JSONFileAdapter(path.join(tempPath, 'voices.json'))
)
// Initialize the EdgeTTS service
const tts = new EdgeTTS();
const voices = await tts.getVoices();
voiceStorage.save('voices',voices)
console.log(`Found ${voices.length} voices`);
async function textToSpeech(text:string,voice:string,options:SynthesisOptions) {
    try {
        const tts = new EdgeTTS();
        await tts.synthesize(text, voice, options);
        return tts;
    } catch (error) {
        throw error;
    }
}
async function processCompleteText(completeText: string): Promise<string | null> {
  // Siempre enviar el texto completo (con expresiones) para mostrar al usuario
  let audioData = null;
  
  if (completeText.length <= 2) return audioData;
  
  try {//*
    // Limpiar el texto y obtener las expresiones
    const cleanedText = await quickClean(completeText);    
    // CAMBIO PRINCIPAL: Procesar audio y expresiones como una unidad
    if (cleanedText.trim()) {
      
      // Solo generar audio si hay texto limpio
      if (cleanedText.trim()) {
        try {
          const resultTTS = await textToSpeech(cleanedText, TTS_Config.voice, TTS_Config.options);
          audioData = resultTTS.toBase64();
        //  queue.add(audioData);
        } catch (ttsError) {
          console.warn('Error generando TTS:', ttsError);
          // Continuar sin audio, pero mantener las expresiones
        }
      }
      
    }
    return audioData;
  } catch (cleanError) {
    console.warn('Error al procesar texto:', cleanError);
    return audioData;
  }
}
export {processCompleteText}