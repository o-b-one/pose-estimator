export abstract class Singleton<T> {

    private static __cached: any;

    public static Provider(payload?) {
        if (this.__cached) {
            return this.__cached;
        }
        this.__cached = new (this as any)();
        if(payload) {
            this.__cached.init(payload);
        }
        return this.__cached;
    }

    public abstract init(payload?: T);

}