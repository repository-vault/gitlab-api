"use strict";

var url         = require('url');

var promisify   = require('nyks/function/promisify');
var request     = require('nyks/http/request');
var read        = require('read');
var mixIn       = require('mout/object/mixIn');
var prequest    = promisify(request);
var pread       = promisify(read);
var interpolate = require('mout/string/interpolate');
var encode      = require('mout/queryString/encode');
var trim        = require('mout/string/trim');
var pluck       = require('mout/array/pluck');


class api {

  constructor(credentials){
    this.credentials = credentials;
    this.api_url     = credentials.api_url;
    delete credentials.api_url;
  }

  format(endpoint, qs){
    endpoint = interpolate(endpoint, qs);

    var query = this.api_url +  endpoint;
    query     = url.parse(query);
    query.qs  = this.credentials;
    if(qs)  mixIn(query.qs, qs);
    query.json = true;
    return query;
  }

    //simple REST (get) call
  rq(endpoint, qs){
    return prequest( this.format.apply(this, arguments) );
  }


   * list_projects(endpoint, chain){
    var per_page = 100;
    var query = this.format("/projects/all", {per_page} );

      //use request (and no rq, as we need all args to fetch headers)
    var tmp = yield request.bind(null, query ),
        projects = tmp[0],
        headers= tmp[1].headers;

    for(var page=2, tmp; page <= headers["x-total-pages"]; page++) {
      tmp = yield rq("/projects/all", {per_page, page} );
      Array.prototype.push.apply(projects, tmp);
    }

    return Promise.resolve(projects);
  }

      //helper to fetch changelogs between two references
  * changelog(project, ref_name, bottom) {
    var per_page = 100, page = 0;
    var log = [];

    do {
      let tmp = yield this.rq("/projects/{{id}}/repository/commits", {id:project, per_page, ref_name, page});
      log.push.apply(log,  tmp);

      let i = pluck(log, "id").indexOf(bottom);
      if(i !== -1)
        return Promise.resolve(log.slice(0, i + 1));

      if(tmp.length == 0)
        return Promise.reject("Cannot find, sorry");
      page ++;
    } while(true);

  }


  * put(endpoint, params){
   console.log("Sending ", params, "to", endpoint);

   var query = mixIn(this.format(endpoint, params), {method: 'PUT'});

   params = trim(encode(params), "?");
   query.headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  if(false)
    yield pread({prompt:"Are you sure (CRL+C to cancel)"});

   return prequest(query, params);
}


}

module.exports = api;