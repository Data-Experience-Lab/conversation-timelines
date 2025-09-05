export class localStorageHelper {
    
    constructor() {

    }

    addToStorage(json) {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        console.log(date)
        localStorage.setItem(date, JSON.stringify(json));
        // localStorage.clear()
    }

    getTodayItem(date) {
        let jsonString = localStorage.getItem(date)
        let json = JSON.parse(jsonString).tree;
        return json;
    }

    getJSONItem() {
        let json;
        const date = new Date();
        date.setHours(0, 0, 0, 0);

        console.log(localStorage.length)
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // If any data has been collected same day, return it
            if (key == date) {
                json = JSON.parse(localStorage.getItem(key)).tree;
            // Remove all old data
            } else if (key!="debug") {
                localStorage.removeItem(key);
            }
        }
        return json
    }
}