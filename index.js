"use strict";

var url         = require('url');

var promisify   = require('nyks/function/promisify');
var read        = require('read');
var mixIn       = require('mout/object/mixIn');
var request     = promisify(require('nyks/http/request'));
var pread       = promisify(read);
var interpolate = require('mout/string/interpolate');
var encode      = require('mout/queryString/encode');
var trim        = require('mout/string/trim');
var pluck       = require('mout/array/pluck');
var drain       = require('nyks/stream/drain');
const json      = require('nyks/stream/json');


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
    return query;
  }

    //simple REST (get) call
  rq(endpoint, qs){
    return request(this.format.apply(this, arguments));
  }


  async list_users() {
    var users = await json(this.rq("/users", {per_page:100}));
    return users;
  }


  async list_projects() {
    var per_page = 100;

    var req = await this.rq("/projects", {per_page} );
    var pages  = res.headers["x-total-pages"];
    var projects = await json(res);

    for(var page=2, tmp; page <= pages; page++) {
      tmp = await json(this.rq("/projects", {per_page, page} ));
      Array.prototype.push.apply(projects, tmp);
    }

    return projects;
  }

   async list_groups() {
    var groups = await json(this.rq("/groups", {per_page:100}));
    return groups;
  }

  async pages(ns) {
    var res = await this.rq(ns, {per_page:1});
    return res.headers["x-total-pages"];
  }

  item(ns, page) {
    return json(this.rq(ns, {per_page:1, page})).then( body => body[0]);
  }

      //helper to fetch changelogs between two references
  async changelog(project, ref_name, bottom) {
    var per_page = 100, page = 0;
    var log = [];

    do {
      let tmp = await json(this.rq("/projects/{{id}}/repository/commits", {id:project, per_page, ref_name, page}));
      log.push.apply(log,  tmp);

      let i = pluck(log, "id").indexOf(bottom);
      if(i !== -1)
        return Promise.resolve(log.slice(0, i + 1));

      if(tmp.length == 0)
        return Promise.reject("Cannot find, sorry");
      page ++;
    } while(true);

  }



  async post(endpoint, params){
    console.log("Sending ", params, "to", endpoint);

    var query = mixIn(this.format(endpoint, params), {method: 'POST'});

    params = trim(encode(params), "?");
    query.headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    if(false)
      await pread({prompt:"Are you sure (CRL+C to cancel)"});

    return request(query, params);
  }



  async put(endpoint, params){
   console.log("Sending ", params, "to", endpoint);

   var query = mixIn(this.format(endpoint, params), {method: 'PUT'});

   params = trim(encode(params), "?");
   query.headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  if(false)
    await pread({prompt:"Are you sure (CRL+C to cancel)"});

   return request(query, params);
}


}

module.exports = api;