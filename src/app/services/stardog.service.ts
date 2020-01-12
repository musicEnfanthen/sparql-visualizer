
import {from as observableFrom,  Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { LocalStorageService } from 'ngx-store';
import { Connection, query, db, HTTP } from 'stardog';
import { HttpClient } from '@angular/common/http';
import * as _ from 'lodash';


import { ProjectSettingsService } from './project-settings.service';

@Injectable()
export class StardogService  extends ProjectSettingsService {

    constructor(
        public localStorageService: LocalStorageService,
        public http: HttpClient
    ) {
        super(localStorageService);
    }

    loadTriples(triples, graphURI?) {
        if (!graphURI) { graphURI = undefined; }
        // const data = this._toJSONLD(triples)
        const conn = this._getConn();
        const database = this._getDB();

        // const mimeType = HTTP.RdfMimeType.TURTLE;
        return observableFrom(
            db.graph.doPut(conn, database, triples, graphURI, 'text/turtle')
        );
        // return Observable.fromPromise(db.graph.doGet(this.conn, 'test'));
    }

    async query(q, reasoningValue?): Promise<any> {
        if (!reasoningValue) { reasoningValue = false; }
        const conn = this._getConn();
        const database = this._getDB();

        const qRes = await query.execute(conn, database, q, undefined, {reasoning: reasoningValue});
        return qRes.body;
    }

    private _getConn() {
        const settings = this.getTriplestoreSettings();

        return new Connection({
            username: settings.username,
            password: settings.password,
            endpoint: settings.endpoint
        });
    }

    private _getDB() {
        return this.getTriplestoreSettings().database;
    }

}
