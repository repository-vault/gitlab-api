<?

/**
* Simple gitlabHQ API REST wrapper
* require yks
*/

class gitlab {
  function __construct($server_url = null, $api_key = null){
    $this->api_key    = $api_key;
    $this->server_url = $server_url;

    if(!$this->api_key)
      throw rbx::error("Usage : clyks gitlab [SERVER_URL] [API_KEY]");

    $whoami = $this->get("/user");
    rbx::ok("Hello {$whoami['name']}");
  }

  function run(){
    $projects = $this->rest_list("/projects/all");
    foreach($projects as $project)
      $this->check_default_protected($project);
  }

  private function check_default_protected($project){
    $pname = $project['name_with_namespace'];

    if(in_array($project['namespace']['path'], array($project['owner']['username'], 'puppet', 'hackathon')))
      return;

    $branches = $this->rest_list("/projects/{$project['id']}/repository/branches");
    $branches = array_reindex($branches, "name");
    $default  = $branches[$project['default_branch']];
    if($default  && !$default['protected']) {
      if(cli::bool_prompt("Protect default {$default['name']} on $pname"))
        $this->put("/projects/{$project['id']}/repository/branches/{$default['name']}/protect");
    }
    rbx::ok("All fine with $pname");
  }




  private function rest_list($endpoint) {
    $data = array();
    $per_page = 100;

    $page = 1; $pages = 0;
    do {
      $path = $endpoint."?per_page=$per_page&page=$page";
      $data = array_merge($data, $this->get($path, $headers));

      if($headers["Link"]) //lookup pagination
        $pages = (int) preg_reduce('#<.*?page=([0-9]+)&per_page=\d+>;\s+rel=.last.#', $headers["Link"]);
    } while($page++ < $pages);

    return $data;
  }

  private function get($path,  &$headers = null){ return $this->rest("GET", $path, $headers); }
  private function put($path,  &$headers = null){ return $this->rest("PUT", $path, $headers); }

  private function rest($METHOD, $path, &$headers = null){
    //rbx::ok("Calling $path");
    $ctx = stream_context_create(array(
      'http' => array(
        'method' => $METHOD,
        'header' => "PRIVATE-TOKEN: {$this->api_key}"
      )
    ));

    $url = "{$this->server_url}/api/v3".$path;
    $str = file_get_contents($url, null, $ctx);

    list(, $code) = preg_split("#\s+#", array_shift($http_response_header), 3);

    if($code != 200)
      throw new Exception("Error while hitting $url");

    $headers = join(CRLF, $http_response_header);
    preg_match_all('#^(.*?):\s*(.*?)$#m', $headers, $out);
    $headers = array_combine($out[1], $out[2]);
    return json_decode($str, true);
  }
}