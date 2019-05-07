var gen = require('./gens.js');
var eva = require('./evaluator.js');
var set = require('./settings.js');

var args = process.argv.slice(2);
const FLAGS = {};

collectFlags();
if(FLAGS.unknown)
  err(`Unknown flag: ${FLAGS.unknown}`)
else
  command();

function collectFlags(){
  args = args.filter( a => {
    if(a.match(/^-{1,2}\w+/)){
      switch(a){
        case "-v":
        case "--verbose":
          FLAGS.verbose = true;
          break;

        case "-E":
        case "--no-escape":
          FLAGS.noEscape = true;
          break;

        case "-e":
        case "--extra-escape":
          FLAGS.extraEscape = true;
          break;

        default:
          FLAGS.unknown = a;
          break;
      }
      return false;
    }
    return true;
  });
}

function command(){
  var macro;
  var cmd = args.shift();
  switch(cmd){
    case "block":
      macro = block();
      break;
    case "eval":
      var file = args.shift();
      macro = eva.evaluateFile(file);
      break;
    default:
      err(`Unknown command: ${args[0]}`)
      break;
  }
  if(macro) returnMacro(macro);
}

function returnMacro(macro){
  if(!FLAGS.noEscape) macro = escapeMacro(macro);
  console.log(macro);
  pbcopy(macro);
}

function block(){
  if(args.length < 4) return err("Not enough arguments for a blocking macro.\nExpecting: [column-to-nullify] [column-to-evaluate] [eveluation-string] [method]\nexample: block id category clothing contains\navailible methods include: equals, starts-with, ends-with, contains");

  var nullCol = gen.Column(args.shift());
  var evalCol = gen.Column(args.shift());
  var evalStr = args.shift();
  var method = args.shift();
  
  return gen.IfStatment(gen.RegexEval(evalCol,evalStr,method,""),nullCol,"");
}

function escapeMacro(macro){
  var chars = macro.split('');
  var layer = 0;
  var a = 0;
  var e;
  return chars.map(c => {
    switch(c){

      case "(":
        if(!e) layer++;
        return escapeChar(c,layer + a - (e ? 0 : 1));

      case ")":
        if(!e) layer--;
        return escapeChar(c,layer + a);

      case ",":
        return escapeChar(c,layer + a - 1);

      case "{":
      case "}":
      case "\\":
        return escapeChar(c,layer + a);

      case set.STRING_DELIMITER:
      case set.REGEX_DELIMITER:
        e = e ? undefined : c;
        a = e == set.STRING_DELIMITER ? 1 : 0;
        return '';

      default:
        return c;

    }
  }).join('');
}


function escapeChar(char, layer){
  if( layer < 1) return char;

  count = 1;

  for(var i = 1; i < layer; i++){
    count = (count * 2) + 1;
  }
  
  for(var i = 0; i < count; i++){
    char = FLAGS.extraEscape ? "\\\\" + char : "\\" + char;
  }
  return char;
}

function pbcopy(data) {
    var proc = require('child_process').spawn('pbcopy');
  proc.stdin.write(data); proc.stdin.end();
  superLog("Copied to clipboard");
}

function superLog(msg){
  var p = "";
  for(var i = -4;i < msg.length; i++){p += "*"}
  console.log(`\n\t${p}\n\t* ${msg} *\n\t${p}\n`);
}

