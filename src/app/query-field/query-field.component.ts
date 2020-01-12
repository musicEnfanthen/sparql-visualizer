import { Component, Input, EventEmitter, Output } from '@angular/core';

import 'codemirror/mode/go/go';
import 'codemirror/mode/sparql/sparql';

import { DataService } from '../services/data.service';

/**
 * @title Table with filtering
 */
@Component({
    selector: 'app-query-field',
    styleUrls: ['query-field.component.css'],
    templateUrl: 'query-field.component.html'
})

export class QueryFieldComponent {

    @Input() reasoning = false;
    @Input() query: string;
    @Input() tabIndex: number;
    @Input() localStore: boolean;
    @Output() updatedQuery = new EventEmitter<string>();
    @Output() doQuery = new EventEmitter<void>();
    @Output() setReasoning = new EventEmitter<boolean>();

    cmConfig = {
        lineNumbers: true,
        firstLineNumber: 1,
        lineWrapping: true,
        matchBrackets: true,
        mode: 'application/sparql-query'
    };

    constructor(
        private _ds: DataService
    ) {}

    onChange(ev) {
        this.updatedQuery.emit(ev);
    }

    fireQuery() {
        this.doQuery.emit();
    }

    resetQuery() {
        this._ds.getSingle(this.tabIndex)
            .subscribe(x => {
                this.query = x.query;
                this.reasoning = x.reasoning;
            });
    }

}
