export class SpeechService{
    static language: string;
    private static readonly _synth = window.speechSynthesis;
    static voice: SpeechSynthesisVoice;
    
    static setLanguage(lang: string) {
        this.language = lang;
    }

    static setVoice(voiceName: string) {
        this.voice = this._synth.getVoices().find(voice => voice.name === voiceName);
    }

    static talk(txt: string){
        this._synth.cancel()
        if(this._synth.speaking){
            return;
        }
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