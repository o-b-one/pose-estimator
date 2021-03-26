export class Singleton<T>{

    private static __cached;
    public static Provider() {
        if (this.__cached) {
            return this.__cached;
        }
        return this.__cached = new this();
    }

    public init(payload?: T){throw new Error("Mehtod not implemented")};

}