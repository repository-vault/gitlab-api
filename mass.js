"use strict";

const path           = require('path');

const gitlab         = require('./');
const minimatch      = require('minimatch');
const glob           = require('glob');

const bprompt        = require('cnyks/prompt/bool');
const eachLimit      = require('async-co/eachLimit');
const eachOfSeries   = require('async-co/eachOfSeries');

const client         = new gitlab(require(path.resolve('credentials.json')));

const opts = require('nyks/process/parseArgs')().dict;


class ctl {

  * run() {

    var config_files = glob.sync("config/**.json"), config = {};
      config_files.forEach( config_path => Object.assign(config, require(path.resolve(config_path)) ) );

    this.config = config;

    var user = yield client.rq("/user");
    console.log(`Hi ${user['name']}`);

    if(!user.is_admin)
      throw "You are not admin";


    if(false) {
      var groups = yield client.list_groups();
      console.log("Found %d groups to work with", groups.length);
      yield eachLimit(groups, 1, this._check_group, this);
    }


    var projects = yield client.list_projects();
    console.log("Found %d projects to work with", projects.length);
    yield eachLimit(projects, 1, this._check_project, this);


  }

  _lookup_config(project) {
    var out = {};

    for(var i in this.config) 
      if(minimatch.makeRe(i).test(project.path_with_namespace))
        Object.assign(out, this.config[i]);
    return out;
  }


  * _check_group(group){

    console.log("Checking group %s#%s", group.name, group.id, group);
  
    var pattern = {
      visibility_level : 0,
      request_access_enabled : false,
    };

    yield eachOfSeries(pattern, function* (prop_value, prop_name) {

      if(group[prop_name] != prop_value)
        yield client.put("/groups/{{id}}", {id : group.id, [prop_name]: prop_value });
    });

  }


  * _check_project(project) {

    console.log("Checking project %s#%s", project.name, project.id);


    var pattern = this._lookup_config(project);

    if(project.archived)
      Object.assign(pattern, {
        merge_requests_enabled : false,
        lfs_enabled : false,
        builds_enabled : false,
      });

    yield eachOfSeries(pattern, function* (prop_value, prop_name) {
      if(project[prop_name] == prop_value)
        return;
      console.log(project.name, "Changing", prop_name, "to", prop_value );

      if( !(opts['cli://unattended']) &&  !(yield bprompt("Proceed", true)))
        return;

      yield client.put("/projects/{{id}}", {id : project.id, [prop_name]: prop_value });
    });
  }



}

module.exports = ctl;