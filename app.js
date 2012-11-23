window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange

function log(message) {
    console.log(message);
}

function createTranslationDB(callback) {
    var DB_NAME = "translations";
    var request = indexedDB.open(DB_NAME, 3);

    request.onupgradeneeded = function (event) {
        var db = event.target.result;
        try {
            db.deleteObjectStore(DB_NAME);
        } catch(e) {
            //normal
        }
        var objectStore = db.createObjectStore(DB_NAME, { keyPath:"id" });
        objectStore.createIndex("searchKey", "searchKey", { unique:false });
    };

    request.onsuccess = function (event) {
        var db = event.target.result;

        function buildSearchKey(translation) {
            return translation.lang + ':' + translation.surface.toLowerCase();
        }

        function getTranslationsByLanguageAndBeginning(langId,surfaceBeginning, callback) {
            surfaceBeginning = surfaceBeginning.toLowerCase();
            var objectStore = db.transaction(DB_NAME).objectStore(DB_NAME);
            var index = objectStore.index("searchKey");
            var translations = [];
            var searchKey = buildSearchKey({lang:langId, surface:surfaceBeginning});
            index.openCursor(IDBKeyRange.lowerBound(searchKey)).onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                    var translation = cursor.value;
                    if (translation.searchKey.startsWith(searchKey)) {
                        translations.push(translation);
                        cursor.continue();
                    } else {
                        callback(translations);
                    }
                }
                else {
                    callback(translations);
                }
            };
        }

        function addTranslations(translations, callback) {
            var transaction = db.transaction(DB_NAME, "readwrite");

            transaction.oncomplete = function (event) {
                callback();
            };

            transaction.onerror = function (event) {
                log(event);
            };

            var objectStore = transaction.objectStore(DB_NAME);

            translations.forEach(function (translation) {
                translation.searchKey = buildSearchKey(translation);
                objectStore.put(translation);
            });
        }

        callback({
            db:db,
            addTranslations:addTranslations,
            getTranslationsByLanguageAndBeginning:getTranslationsByLanguageAndBeginning
        });
    };

}


function main() {
    var dummyTranslations = [
        {
            id:1,
            surface:'dog',
            lang: 'en',
            translations:[
                {
                    id:'100',
                    lang: 'de',
                    surface:'Hund'
                },
                {
                    id:'101',
                    lang: 'de',
                    surface:'Köter'
                },
                {
                    id:'102',
                    lang: 'ind',
                    surface:'anjing'
                }
            ]
        },
        {
            id:2,
            surface:'duck',
            lang: 'en',
            translations:[
                {
                    lang: 'de',
                    surface:'Ente'
                }
            ]

        },
        {
            id:3,
            surface:'tree',
            lang: 'en',
            translations:[
                {
                    lang: 'de',
                    surface:'Baum'
                }
            ]

        },
        {
            id:4,
            surface:'makan',
            lang: 'ind',
            translations:[
                {
                    lang: 'de',
                    surface:'essen'
                }
            ]
        },
        {
            id:5,
            surface:'make',
            lang: 'en',
            translations:[
                {
                    lang: 'de',
                    surface:'machen'
                }
            ]
        }
    ];

    createTranslationDB(function (tdb) {
        tdb.addTranslations(dummyTranslations, function () {
            tdb.getTranslationsByLanguageAndBeginning('en','d', function (t) {
                log(t);
            });
        });

        function ViewModel() {
            var self = this;
            this.query = ko.observable('');
            this.languages = ko.observableArray([
                {id:'de', name:'German'},
                {id:'en', name:'English'},
                {id:'ind', name:'Indonesian'}
            ]);
            this.sourceLanguage = ko.observable(this.languages()[1]);
            this.targetLanguage = ko.observable(this.languages()[0]);
            this.translations = ko.observableArray([]);
            ko.computed(function () {
                var query = self.query().trim();
                if (query.length==0) {
                    self.translations([]);
                    return;
                }
                var langId = self.targetLanguage().id;
                tdb.getTranslationsByLanguageAndBeginning(self.sourceLanguage().id,query, function (translations) {
                    translations.forEach(function (translation) {
                        translation.targetTranslations = translation.translations.filter({lang:langId});
                    });
                    self.translations(translations);
                });
            });
        }

        ko.applyBindings(new ViewModel());

    });
}

$(main());