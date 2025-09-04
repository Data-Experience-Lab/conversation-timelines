export class localStorage {
    
    constructor() {

    }

    addToStorage(json) {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        console.log(date)
        localStorage.setItem(date, json);
    }

    getFullList() {
        const items = { ...localStorage };
        console.log(items)
    }

    removeFromStorage() {

    }

}