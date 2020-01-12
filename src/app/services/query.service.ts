import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { from as observableFrom } from 'rxjs';

import * as Hylar from 'hylar';
import * as _ from 'lodash';
import * as N3 from 'n3';
import * as rdfstore from 'rdfstore';

export interface Qres {
    actions?;
    duplicates?: object[];
    triples?: Triple[];
}

export interface Triple {
    subject: TripleComponent;
    predicate: TripleComponent;
    object: TripleComponent;
}

export interface TripleComponent {
    nominalValue;
}

export interface HylarConstruct {
    subject: string;
    predicate: string;
    object: string;
}

@Injectable()
export class QueryService {

    private store;
    private prefixesPromise;

    constructor( public http: HttpClient ) { }

    doHylarQuery(query, triples) {

        console.log('Do Hylar query');

        const h = new Hylar();

        // tslint:disable-next-line:no-shadowed-variable
        const saturateAndQuery = async (query, triples) => {

            const start = Date.now();
            const mimeType = 'text/turtle';
            const keepOldValues = false;

            const saturation = await h.load(triples, mimeType, keepOldValues);
            if (!saturation) { console.log('Graph saturation failed.'); }

            let res = await h.query(query);

            // Register query time
            const end = Date.now();
            const elapsed = (end - start) / 1000;
            const message = `Returned ${res.length} triples in ${elapsed} seconds`;
            console.log(message);

            // Process result
            if (res.triples) { res = res.triples; }

            const queryType = this.getQuerytype(query);

            // Return JSON formatted results for SELECT queries
            if (queryType === 'select') {
                res = this.sparqlJSON(res).data;
            } else {
                res = _.map(res, x => _.mapValues<any>(x, y => y.nominalValue));
            }

            return res;

        };

        return observableFrom(saturateAndQuery(query, triples));
    }

    doQuery(query, triples, mimeType?) {

        if (!mimeType) { mimeType = 'text/turtle'; }

        // Get query type
        const queryType = this.getQuerytype(query);

        return this._createStore()
            .then(store => {
                this.store = store;
                this.prefixesPromise = this._getPrefixes(triples);
                return this._loadTriplesInStore(store, triples, mimeType);
            })
            .then(storeSize => {
                // console.log(storeSize);
                return this._executeQuery(this.store, query);
            })
            .then(res => {
                const data: Qres = res;

                // Reformat data if select query
                if (queryType === 'select') {
                    return this.sparqlJSON(data).data;
                }

                /**
                 * NB! THE PREFIXING SHOULD BE HANDLED BY A PIPE!
                 */

                // Get prefixes
                return this.prefixesPromise.then(prefixes => {

                    // Process result
                    return _.chain(data.triples).map(x => {
                        let s = x.subject.nominalValue;
                        let p = x.predicate.nominalValue;
                        let o = x.object.nominalValue;

                        // Abbreviate turtle format
                        if (mimeType === 'text/turtle') {
                            if (this._abbreviate(s, prefixes) != null) {
                                s = this._abbreviate(s, prefixes);
                            }
                            if (this._abbreviate(p, prefixes) != null) {
                                p = this._abbreviate(p, prefixes);
                            }
                            if (this._abbreviate(o, prefixes) != null) {
                                o = this._abbreviate(o, prefixes);
                            }
                        }

                        return {subject: s, predicate: p, object: o};
                    }).value();
                });

            });

    }

    public getQuerytype(query) {

        let keyWords = [
            {text: 'select', index: -1},
            {text: 'construct', index: -1},
            {text: 'count', index: -1},
            {text: 'describe', index: -1},
            {text: 'insert', index: -1},
            {text: 'delete', index: -1}
        ];

        // Get indexes and set a variable if at least one matches + store lowest index

        let match = false;  // Set to true if some keyword match is found
        let low = Infinity;

        keyWords = keyWords.map(item => {
            item.index = query.toLowerCase().indexOf(item.text);
            if (item.index !== -1) {
                match = true;
                if (item.index < low) { low = item.index; }
            }
            return item;
        });

        // If none of the keywords match return null
        if (!match) { return null; }

        // If more exist, take the lowest
        const lowest = keyWords.find(item => item.index === low);
        if (!lowest) { return null; }
        const type = lowest.text;

        if (type === 'insert' || type === 'delete') { return 'update'; }

        return type;

    }

    public sparqlJSON(data) {
        // Get variable keys
        const varKeys = _.keysIn(data[0]);

        // check that it doesn't return null results
        if (data[0][varKeys[0]] == null) {
            return {status: 400, data: 'Query returned no results'};
        }

        // Flatten object array
        const b = _.flatMap(data);

        // Rename keys according to below mapping table
        const map = {
            token: 'type',
            type: 'datatype',
            lang: 'xml:lang'
        };

        // Loop over data to rename the keys
        for (const i in b) {
            if (b.hasOwnProperty(i)) {
                for (const key in varKeys) {
                    if (varKeys.hasOwnProperty(key)) {
                        b[i][varKeys[key]] = this._renameKeys(b[i][varKeys[key]], map);
                    }
                }
            }
        }

        // Re-format data
        const reformatted = {head: {vars: varKeys}, results: {bindings: b}};

        return {status: 200, data: reformatted};
    }

    public extractPrefixesFromTTL(triples) {
        // Replace all whitespace characters with a single space and split by space
        // remove empty values
        const arr = triples.replace(/\s/g, ' ').split(' ').filter(el => el !== '');

        // Get index of all occurences of @prefix
        const pfxIndexes = arr.reduce((a, e, i) => {
            if (e === '@prefix') { a.push(i); }
            return a;
        }, []);

        const obj = {};
        pfxIndexes.forEach(i => {
            obj[arr[i + 1]] = arr[i + 2];
        });

        return obj;
    }

    public nameSpacesInQuery = (str) => {
        const array = [];

        const regex = /[a-zA-Z]+\:/g;

        while (regex.exec(str) !== null) {
            const m = regex.exec(str);

            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            // The result can be accessed through the `m`-variable.
            m.forEach((match) => {
                match = match.slice(0, -1);
                if (array.indexOf(match) === -1) {
                    array.push(match);
                }
            });
        }
        return array;
    }

    public appendPrefixesToQuery(query, triples) {

        // Get prefixes from triples
        const prefixes = this.extractPrefixesFromTTL(triples);

        // Get prefixes in query
        const namespaces = this.nameSpacesInQuery(query);

        // Append the used namespaces to the query
        const keys = Object.keys(prefixes);
        let pfxString = '';
        keys.forEach(key => {
            if (namespaces.indexOf(key.slice(0, -1)) !== -1) {
                pfxString += `PREFIX ${key} ${prefixes[key]}\n`;
            }
        });

        if (pfxString !== '') {
            query = pfxString + '\n' + query;
        }

        return query;

    }

    private _createStore() {
        return new Promise( (resolve, reject) => {
            rdfstore.create((err, store) => {
                if (err) { reject(err); }
                resolve(store);
            });
        });
    }

    private _loadTriplesInStore(store, triples, mimeType?) {
        if (!mimeType) { mimeType = 'text/turtle'; }
        return new Promise((resolve, reject) => {
            store.load(mimeType, triples, (err, size) => {
                if (err) { reject(err); }
                resolve(size);
            });
        });
    }

    private _executeQuery(store, query) {
        return new Promise((resolve, reject) => {
            store.execute(query, (err, res) => {
                if (err) { reject(err); }
                resolve(res);
            });
        });
    }

    private _getPrefixes(triples) {
        // ParseTriples
        const parser = N3.Parser();
        return new Promise( (resolve, reject) => {
                parser.parse(triples, (err, triple, prefixes) => {
                    if (!triple) {
                        resolve(prefixes);
                    }
                    if (err) {
                        reject(err);
                    }
                });
            }
        );
    }

    private _abbreviate(foi, prefixes) {
        let newVal = null;
        // If FoI has 'http' in its name, continue
        if (foi.indexOf('http') !== -1) {
            // Loop over prefixes
            _.each(prefixes, (val, key) => {
                // If the FoI has the prefixed namespace in its name, return it
                if (foi.indexOf(val) !== -1) {
                    newVal = foi.replace(val, key + ':');
                }
            });
        }
        return newVal;

    }

    public _abbreviateTriples(triples, prefixes) {

        const abrTriples = [];

        function abbreviate(foi) {
            let newVal = null;
            // If FoI has 'http' in its name, continue
            if (foi.indexOf('http') !== -1) {
                // Loop over prefixes
                _.each(prefixes, (val, key) => {
                    // If the FoI has the prefixed namespace in its name, return it
                    if (foi.indexOf(val) !== -1) {
                        newVal = foi.replace(val, key + ':');
                    }
                });
            }
            return newVal;

        }

        _.each(triples, d => {
            let s = d.subject;
            let p = d.predicate;
            let o = d.object;

            if (abbreviate(s) != null) { s = abbreviate(s); }
            if (abbreviate(p) != null) { p = abbreviate(p); }
            if (abbreviate(o) != null) { o = abbreviate(o); }
            abrTriples.push({subject: s, predicate: p, object: o});
        });
        return abrTriples;
    }

    private _renameKeys(obj, newKeys) {
        const keyValues = Object.keys(obj).map(key => {
            const newKey = newKeys[key] || key;
            return { [newKey]: obj[key] };
        });
        return Object.assign({}, ...keyValues);
    }

}
