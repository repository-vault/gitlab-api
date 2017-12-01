"use strict";

const path           = require('path');

const gitlab         = require('./');
const minimatch      = require('minimatch');
const glob           = require('glob');

const values         = require('mout/object/values');
const pick           = require('mout/object/pick');
const diff           = require('mout/array/difference');

const bprompt        = require('cnyks/prompt/bool');
const eachLimit      = require('async-co/eachLimit');
const eachOfSeries   = require('async-co/eachOfSeries');

const client         = new gitlab(require(path.resolve('credentials.json')));

const opts = require('nyks/process/parseArgs')().dict;


class ctl {

  constructor() {

    this.client = client;

    var projects_files = glob.sync("config/projects/**.json"), config = {};
      projects_files.forEach( config_path => Object.assign(config, require(path.resolve(config_path)) ) );

    this.config = config;

    var users_files = glob.sync("config/groups/**.json"), groups = {};
      users_files.forEach( config_path => Object.assign(groups, require(path.resolve(config_path)) ) );

    this.groups = groups;
  }

  async run() {

    var user = await client.rq("/user");
    console.log(`Hi ${user['name']}`);

    if(!user.is_admin)
      throw "You are not admin";

    var tmp = await this.client.list_users();
    var users = {};
      tmp.forEach( user => users[user.email] = user.id )
    this.users = users;


    if(false) {
      var groups = await client.list_groups();
      console.log("Found %d groups to work with", groups.length);
      await eachLimit(groups, 1, this._check_group, this);
    }

    if(false) {
      var projects = await client.list_projects();
      console.log("Found %d projects to work with", projects.length);
      await eachLimit(projects, 1, this._check_project, this);
    }
  }


  _lookup_config(project) {
    var out = {};

    for(var i in this.config) 
      if(minimatch.makeRe(i).test(project.path_with_namespace))
        Object.assign(out, this.config[i]);
    return out;
  }

  expand_users(users) {
    var out = [];
    users.forEach( (item) => {
      var group = this.groups[item];
      if(group)
        out = out.concat( this.expand_users( group) );
      else
        out.push(item);
    }, this);
    return out;
  }

  async _check_group(group){

    console.log("Checking group %s#%s", group.name, group.id, group);
  
    var pattern = {
      visibility_level : 0,
      request_access_enabled : false,
    };

    await eachOfSeries(pattern, async(prop_value, prop_name) => {

      if(group[prop_name] != prop_value)
        await client.put("/groups/{{id}}", {id : group.id, [prop_name]: prop_value });
    });

  }


  async _check_project(project) {

    console.log("Checking project %s#%s", project.name, project.id);

    var pattern = this._lookup_config(project);
console.log(pattern);

    var members = pattern.members;
      delete pattern.members;

    if(members) {
      var current = await client.rq("/projects/{{id}}/members", { id : project.id } );
      current = require('mout/array/pluck')( current, 'id');

      
      var target = values(pick(this.users, this.expand_users(members))).filter( v => !!v);


      var missing = diff(target, current );
      await eachLimit(missing, 1, async(user_id) => {
        await client.post("/projects/{{id}}/members", { id : project.id,  user_id, access_level : 30} );
      });


      process.exit();
    }
    
    await eachOfSeries(pattern, async(prop_value, prop_name) => {

      if(project[prop_name] == prop_value)
        return;
      console.log(project.name, "Changing", prop_name, "to", prop_value );

      if( !(opts['cli://unattended']) &&  !(await bprompt("Proceed", true)))
        return;

      await client.put("/projects/{{id}}", {id : project.id, [prop_name]: prop_value });
    });
  }

}

module.exports = ctl;
