export class SpeechService{
    private static readonly _synth = window.speechSynthesis;
    
    static language: string;
    static voice: SpeechSynthesisVoice;
    
    static setLanguage(lang: string) {
        this.language = lang;
    }

    static setVoice(voiceName: string) {
        this.voice = this._synth.getVoices().find(voice => voice.name === voiceName);
    }

    static talk(txt: string){
        if(this._synth.speaking){
            return;
        }
        this._synth.cancel()
        const conf = new SpeechSynthesisUtterance(txt);
        conf.lang = this.language;
        if(this.voice){
            conf.voice = this.voice;
        }
        this._synth.speak(conf);
    }

}

SpeechService.setVoice('Google UK English Female');
SpeechService.setLanguage('en-GB');