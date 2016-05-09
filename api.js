"use strict";

var util        = require('util');
var co          = require('co');

var url         = require('url');
var credentials = require('./credentials.json');
var promisify   = require('nyks/function/promisify');
var request     = require('nyks/http/request');
var read        = require('read');
var mixIn       = require('mout/object/mixIn');
var prequest    = promisify(request);
var pread       = promisify(read);
var interpolate = require('mout/string/interpolate');

var eachLimit   = require('async-co/eachLimit');
var encode      = require('mout/queryString/encode');
var trim        = require('mout/string/trim');

var api_url     = credentials.api_url;
delete credentials.api_url;

var format = function(endpoint, qs){
  var query = api_url +  endpoint;
  query     = url.parse(query);
  query.qs  = credentials;
  if(qs)  mixIn(query.qs, qs);
  query.json = true;
  return query;
}

var list_projects = function*(endpoint, chain){
  var per_page = 100;
  var query = format("/projects/all", {per_page} );

    //use request (and no rq, as we need all args to fetch headers)
  var tmp = yield request.bind(null, query ),
      projects = tmp[0],
      headers= tmp[1].headers;


  for(var page=1, tmp; page <= headers["x-total-pages"]; page++) {
    tmp = yield rq("/projects/all", {per_page, page} );
    Array.prototype.push.apply(projects, tmp);
  }

  return Promise.resolve(projects);
}


var rq = function(endpoint, qs){
  return prequest( format.apply(null, arguments) );
}

var call = function *(endpoint, params){
   console.log("Sending ", params, "to", endpoint);

   endpoint = interpolate(endpoint, params);

   var query = mixIn(format(endpoint), {method: 'PUT'});
   params = trim(encode(params), "?");
   query.headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  if(false)
    yield pread({prompt:"Are you sure (CRL+C to cancel)"});

   return prequest(query, params);
}



//PUT /projects/:id

co(function*(){
  var user = yield rq("/user");
  console.log(`Hi ${user['name']}`);

  if(!user.is_admin)
    throw "You are not admin";

  var projects = yield list_projects();
  console.log("Found %d projects to work with", projects.length);

  yield eachLimit(projects, 1, function*(project){
    console.log("Checking %s#%s", project.name, project.id);
  
    if(project.issues_enabled)
     yield call("/projects/{{id}}", {id : project.id, issues_enabled : false });

    if(project.wiki_enabled) 
     yield call("/projects/{{id}}", {id : project.id, wiki_enabled : false });
    
    if(project.builds_enabled)
     yield call("/projects/{{id}}", {id : project.id, builds_enabled : false });

    if(project.snippets_enabled)
      yield call("/projects/{{id}}",  {id : project.id, snippets_enabled : false });

  } );



}).catch(function(err){
  console.log("FAILURE", err);
});



