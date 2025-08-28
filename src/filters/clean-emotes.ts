export function removeEmotes(message?: string):string {
    if (!message || typeof message !== 'string') return message || '';    
    // Regex pattern to match [emote:number:string] format
    const emotePattern = /\[emote:\d+:[^\]]+\]/g;
    
    return message.replace(emotePattern, '').trim();
}
