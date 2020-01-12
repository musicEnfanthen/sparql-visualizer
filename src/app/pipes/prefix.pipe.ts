import { Pipe, PipeTransform } from '@angular/core';

import * as _ from 'lodash';
import * as moment from 'moment';

import { DataService } from '../services/data.service';


export interface Value {
    type?: string;
    datatype?: string;
    value: string;
}

@Pipe({name: 'prefix', pure: false})
export class PrefixPipe implements PipeTransform {

    prefixes = [
        {prefix: 'rdf', uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'},
        {prefix: 'rdfs', uri: 'http://www.w3.org/2000/01/rdf-schema#'},
        {prefix: 'xsd', uri: 'http://www.w3.org/2001/XMLSchema#'},
        {prefix: 'prov', uri: 'http://www.w3.org/ns/prov#'},
        {prefix: 'opm', uri: 'https://w3id.org/opm#'},
        {prefix: 'seas', uri: 'https://w3id.org/seas/'},
        {prefix: 'sd', uri: 'http://www.w3.org/ns/sparql-service-description#'},
        {prefix: 'bot', uri: 'https://w3id.org/bot#'},
        {prefix: 'cdt', uri: 'http://w3id.org/lindt/custom_datatypes#'},
        {prefix: 'props', uri: 'https://w3id.org/product/props#'},
        {prefix: 'inst', uri: 'https://www.niras.dk/proj100/'},
        {prefix: 'owl', uri: 'http://www.w3.org/2002/07/owl#'}
    ];

    constructor(private ds: DataService) {}

    transform(value: Value): any {

        let val: string = value.value;

        if (value.type === 'uri') {
            const abr = this._abbreviate(val, this.prefixes);
            if (abr) { val = abr; }
        }

        if (value.type === 'literal') {

            // timestamps
            if (value.datatype === 'http://www.w3.org/2001/XMLSchema#dateTime') {

                moment.locale('en-uk');
                val = moment(val).format('LLL'); // displays something like March 22, 2018 1:00 PM
                // val = moment(val).fromNow(); // displays something like "yesterday", "in 2 days", "19 hours ago", "a minute ago" etc.

                // Decimal numbers
            } else if (parseFloat(val)) {
                val = parseFloat(val).toFixed(2);
            }
        }

        return val;
    }

    private _abbreviate(foi, prefixes) {
        let newVal: string;
        // Loop over prefixes
        _.each(prefixes, p => {
            const prefix = p.prefix;
            const uri = p.uri;
            if (foi.indexOf(uri) !== -1) {
                newVal = foi.replace(uri, prefix + ':');
            }
        });
        return newVal;
    }

}
