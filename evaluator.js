fs = require('fs');
gen = require('./gens.js');
set = require('./settings.js');

function evaluateFile(filePath){
  var content
  if(!filePath) return null;
  try{ content = fs.readFileSync(filePath).toString(); }
  catch(e){ err(`Error parsing file: ${filePath}`) }
  return parseContent(content);
}

function parseContent(content){
  content = content.replace(/\s+/g," ").trim();
  var parts = tokenize(content);
  return processStatements(parts);
}

function processStatements(tokens){
  var statements = [];

  for(var i = 0; i < tokens.length; i++){
    var operator;

    switch(tokens[i]){

      case "if":
      case "if(":
        let { index, statement } = captureIfStatement(tokens, i);
        statements.push(statement);
        i = index;
        break;

      case "id":
      case "title":
      case "description":
      case "price":
      case "price_old":
      case "category":
      case "url_product":
      case "url_image":
      case "url_imagebig":
      case "currency":
        statements.push(gen.Column(tokens[i]));
        break;

      case "==":
      case "===":
      case "equals":
      case "^=":
      case "start_with":
      case "begins_with":
      case "=$":
      case "ends_with":
      case "includes":
        operator = tokens[i];
        continue;

      default:

        // handle regex and strings
        if(tokens[i].match(/^\".*\"$|^\/.*\/$/)){
          statements.push(handleEscapable(tokens[i]));
          break;
        }

        // handle functions
        if(tokens[i].match(/\..+\(/)){
          let { index, statement } = handleFunction(tokens, statements.pop(), i);
          statements.push(statement);
          i = index;
          break;
        }

        // handle numbers
        if(tokens[i].match(/^\d+$/)){
          statements.push(tokens[i]);
          break;
        }

        // handle failure to parse token
        console.log(tokens);
        err(`I don't know what to do with this token: ${tokens[i]}`);

    }
    if(operator){
      var statement = handleOperator(statements[statements.length -2],operator,statements[statements.length -1]);
      statements.pop();
      statements[statements.length - 1] = statement;
    }
  }
  return statements.join('');
  
}

function handleEscapable(expression){
  if(expression.match(/^\//)) return handleRegex(expression);
  if(expression.match(/^\"/)) return handleString(expression);

  console.log(`I dont know what to do with this expression: ${expression}`);
  process.exit();
}

function handleString(expression){
  expression = expression.replace(/^\"|\"$/g, set.STRING_DELIMITER);
  return expression;
}

function handleRegex(expression){
  return expression.replace(/^\/|\/$/g, set.REGEX_DELIMITER);
}

function handleFunction(tokens, subject, index){
  switch(tokens[index]){
    case ".match(":
      return catureMatchStatement(tokens, subject, index)
    case ".replace(":
      return captureReplaceStatement(tokens, subject, index)
    default:
      console.log(`I don't know what to do with this function: ${tokens[index].replace(/^\.|\($/,'')}`)
      process.exit();
  }
}

function handleOperator(left,op,right){
  switch(op){

    case "==":
    case "===":
      return handleEquality(left,right);

    default:
      console.log(`I don't know how to handle the operator: ${op}`);
  }
}

function handleEquality(a,b){
  return gen.IfStatment(
    gen.Replace(a,b,""),
    "",
    "true"
  )
}

function captureReplaceStatement(tokens, subject, index){
  var { endingIndex, args } = extractInternalsFromBrackets(tokens, "(", index);

  if(args.length != 2) err(`Wrong number of arguments for replace function, expected 2, get ${args.length}`);

  var isRegex = args[0].length == 1 && args[0][0].match(/^\/.*\/$/),
    expression = processStatements(args[0]),
    replacement = processStatements(args[1]),
    statement = handleReplaceStatement(subject, expression, replacement, isRegex);

  return {
    index: endingIndex,
    statement
  }
}

function handleReplaceStatement(subject, expression, replacement, isRegex){
  var func = isRegex ? gen.RegexReplace : gen.Replace;
  return func(subject,expression,replacement);
}

function catureMatchStatement(tokens, subject, index){
  var { endingIndex, args } = extractInternalsFromBrackets(tokens, "(", index),
    statement;

  switch(args.length){

    case 1:
      statement = handleMatch(subject, processStatements(args[0]));
      break;

    case 2:
      statement = handleCapture(subject, processStatements(args[0]), processStatements(args[1]));
      break;

    default:
      err(`Wrong number of arguments for match function, expected 1 or 2, got ${args.length}`);
  }

  return {
    index: endingIndex,
    statement
  };

}

// TODO since a single argument match statment would be indended to have a boolean response then this should be packed like a capture inside of an if statement
function handleMatch(subject, expression){
  var func = expression[0] === String.fromCharCode(135) ? gen.RegexReplace : gen.Replace;
  return gen.IfStatment(
    func(subject, expression, ''),
    "",
    "true"
  )
}

function handleCapture(subject, expression, index){
  if(isNaN(parseInt(index))) warning("Second of two  arguments in a match statment should be capture group index (int)");
  if(expression[0] !== set.REGEX_DELIMITER || !expression.match(/(.*)/)) warning("First of two arguments in a match statement should be a regex with at least one capture group")
  index = isNaN(parseInt(index)) ? index : `$${index}`;
  return gen.RegexReplace(subject,expression,index);
}

function captureIfStatement(tokens, index){
  var {endingIndex, args } = extractInternalsFromBrackets(tokens,"(",index);
  var condition = processStatements(args[0]);
  var {endingIndex, args} = extractInternalsFromBrackets(tokens,"{",endingIndex);
  var whenTrue = processStatements(args[0]);
  var whenFalse = "";
  if(tokens[endingIndex + 1] && tokens[endingIndex + 1] == "else"){
    var {endingIndex, args} = extractInternalsFromBrackets(tokens,"{",endingIndex + 1);
    whenFalse = processStatements(args[0]);
  }

  return {
    statement: gen.IfStatment(condition,whenTrue,whenFalse),
    index: endingIndex
  }

}

function extractInternalsFromBrackets(parts, token, indexOffset = 0){
  var depth = -1;
  var args = [];
  for( var i = indexOffset; i < parts.length; i++){
    var inversToken = getInversToken(token);
    var startingIndex;
    var intermediateIndex;
    switch(parts[i]){

      case token:
        if(depth < 0)
          intermediateIndex = startingIndex = i + 1;
        depth++;
        break;

      case inversToken:
        if(depth == 0){
          args.push(parts.slice(intermediateIndex,i))
          return { endingIndex: i, startingIndex, args };
        }
        depth--;
        break;

      case ",":
        if(depth == 0 && token === "("){
          args.push(parts.slice(intermediateIndex,i));
          intermediateIndex = i + 1;
        }
        break;

      default:
        if(token === "(" && parts[i].match(/\($/)){
          if(depth < 0)
            intermediateIndex = startingIndex = i + 1;
          depth++;
          break;
        }
    }
  }
};

function getInversToken(token){
  var inverter = {
    "(":")",
    ")":"(",
    "[":"]",
    "]":"[",
    "{":"}",
    "}":"{",
    '"':'"',
    "'":"'",
    "`":"`",
    "/":"/"
  }
  return inverter[token];
}

function tokenize(content){

  var tokens = content.split('');
  tokens = groupEscapeable(tokens,'"',true);
  // console.log(tokens)
  tokens = groupEscapeable(tokens,"/",true);
  // console.log(tokens)
  tokens = groupTokens(tokens);
  // console.log(tokens)
  return tokens

}

function groupEscapeable(tokens,token,escapeable){
  var grouped = [], found, breakNext;

  for(var i = 0;i < tokens.length; i++){
    switch(tokens[i]){
      case token:
        if(found){
          if(escapeable && i > 0 && tokens[i-1] === "\\"){
            continue;
          } else {
            grouped.push(tokens.slice(found,i+1).join(''));
            found = undefined;
            token = getInversToken(token);
          }
        } else {
          found = i;
          token = getInversToken(token);
        }
        break;
      default:
        if(found) continue;
        else grouped.push(tokens[i]);
    }
  }
  return grouped;
}

function groupTokens(tokens){
  var grouped = [], 
    index,
    token = "",
    addToken = (t) => {
      if(token) grouped.push(token);
      token = "";
      if(t) grouped.push(t);
    };

  for(var i = 0; i < tokens.length; i++){
    switch(tokens[i]){

      case " ":
        addToken();
        break;

      case ".":
        addToken();
        token += tokens[i];
        break;

      case ",":
      case ")":
      case "{":
      case "}":
      case "]":
        addToken(tokens[i]);
        break;

      case "(":
      case "[":
        token += tokens[i];
        addToken();
        break;

      default:
        token += tokens[i];

    }
  }
  return grouped;
}

function superLog(msg){
  var p = "";
  for(var i = -4;i < msg.length; i++){p += "*"}
  console.log(`\n\t${p}\n\t* ${msg} *\n\t${p}\n`);
}

function err(msg){
  console.log(msg ? msg : "Parsing error");
  process.exit();
}

function warning(msg){
  console.log(`***** Warning *****\n\t${msg}`);
}

module.exports = {
  evaluateFile,
  err,
}

