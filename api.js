"use strict";

var co          = require('co');
var eachLimit   = require('async-co/eachLimit');


var gitlab = require('./');
var client = new gitlab(require('./credentials.json'));

//PUT /projects/:id

co(function*(){
  var user = yield client.rq("/user");
  console.log(`Hi ${user['name']}`);

  if(!user.is_admin)
    throw "You are not admin";


  var diff = yield client.changelog(21, "a9faa71b99d655e6aa27b1812421ba4626982279", "4b782bff202b01e0fff426e773d25526cda0e178");

  console.log(diff, diff.length);
  throw "o";


  var projects = yield client.list_projects();
  console.log("Found %d projects to work with", projects.length);

  yield eachLimit(projects, 1, function*(project){
    console.log("Checking %s#%s", project.name, project.id);
  
    if(project.issues_enabled)
     yield client.pull("/projects/{{id}}", {id : project.id, issues_enabled : false });

    if(project.wiki_enabled) 
     yield client.pull("/projects/{{id}}", {id : project.id, wiki_enabled : false });
    
    if(project.builds_enabled)
     yield client.pull("/projects/{{id}}", {id : project.id, builds_enabled : false });

    if(project.snippets_enabled)
      yield client.pull("/projects/{{id}}",  {id : project.id, snippets_enabled : false });

  } );



}).catch(function(err){
  console.log("FAILURE", err);
});



