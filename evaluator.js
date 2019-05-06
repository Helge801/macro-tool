fs = require('fs');
gen = require('./gens.js');

function evaluateFile(filePath){
  var content
  if(!filePath){
    console.log('filepath expected for eval command');
    return null;
  }
  try{ content = fs.readFileSync(filePath).toString(); }
  catch(e){ console.log(`Error parsing file: ${filePath}`) }
  return parseContent(content);
}

function parseContent(content){
  content = content.replace(/\s+/g," ").trim();
  console.log(content);
  var parts = tokenize(content);
  console.log(parts);
  return groupStatements(parts);
}

function groupStatements(tokens){
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

        // check if token is a string or regex
        if(tokens[i].match(/^\".*\"$|^\/.*\/$/)){
          statements.push(tokens[i].replace(/^\"|\"$/g,""));
          break;
        }

        // check if token is a function
        if(tokens[i].match(/\..+\(/)){
          let { index, statement } = handleFunction(tokens, statements.pop(), i);
          statements.push(statement);
          i = index;
          break;
        }

        // handle failure to parse token
        console.log(`I don't know what to do with this token: ${tokens[i]}`);
        console.log(tokens);
        process.exit();

    }
    if(operator){
      var statement = handleOperator(statements[statements.length -2],operator,statements[statements.length -1]);
      statements.pop();
      statements[statements.length - 1] = statement;
    }
  }
  return statements.join('');
  
}

function handleFunction(tokens, subject, index){
  switch(tokens[index]){
    case ".match(":
      return catureMatchStatement(tokens, subject, index)
    default:
      console.log(`I don't know what to do with this function: ${tokens[i].replace(/^\.|\($/,'')}`)
  }

  superLog("functions not yet handled");
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

function catureMatchStatement(tokens, subject, index){
  var { startingIndex, endingIndex } = extractInternalsFromBrackets(tokens, "(", index);
  return {
    statement: handleMatch(subject, groupStatements(tokens.slice(startingIndex,endingIndex))),
    index: endingIndex
  };
}

// Potential issue with evalutaing regex. Regex will be evaluted 
function handleMatch(left,right){
  
  var func = right.match(/^\/.*\/$/) ? gen.RegexReplace : gen.Replace;
  return gen.IfStatment(
    func(left,right.replace(/^\/|\/$/g,''),''),
    "",
    "true"
  )
}

function captureIfStatement(tokens, index){
  var { startingIndex, endingIndex } = extractInternalsFromBrackets(tokens,"(",index);
  var condition = groupStatements(tokens.slice(startingIndex,endingIndex));
  var {startingIndex,endingIndex} = extractInternalsFromBrackets(tokens,"{",endingIndex);
  var whenTrue = groupStatements(tokens.slice(startingIndex,endingIndex));
  var whenFalse = "";
  if(tokens[endingIndex + 1] && tokens[endingIndex + 1] == "else"){
    console.log("found else statement")
    var {startingIndex,endingIndex} = extractInternalsFromBrackets(tokens,"{",endingIndex + 1);
    whenFalse = groupStatements(tokens.slice(startingIndex,endingIndex));
  }

  return {
    statement: gen.IfStatment(condition,whenTrue,whenFalse),
    index: endingIndex
  }

}

function extractInternalsFromBrackets(parts, token, indexOffset = 0){
  if(parts[indexOffset].match(RegExp(`.+\\${token}$`))) parts[indexOffset] = token;
  var depth = -1;
  for( var i = indexOffset; i < parts.length; i++){
    var inversToken = getInversToken(token);
    var startingIndex;
    switch(parts[i]){
      case token:
        if(depth < 0)
          startingIndex = i + 1;
        depth++;
        break;
      case inversToken:
        if(depth == 0)
          return {endingIndex: i, startingIndex};
        depth--;
        break;
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
  console.log(`Original tokens:\n${tokens}`);
  tokens = groupEscapeable(tokens,'"',true);
  console.log(`Originalfter quotes tokens:\n${tokens}`);
  tokens = groupEscapeable(tokens,"/",true);
  console.log(`After regex tokens:\n${tokens}`);
  tokens = groupTokens(tokens);
  console.log(`after grouping  tokens:\n${tokens}`);
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

function parseError(parts){
  console.log("Parsing Error");
}

function superLog(msg){
  var p = "";
  for(var i = -4;i < msg.length; i++){p += "*"}
  console.log(`\n\t${p}\n\t* ${msg} *\n\t${p}\n`);
}

function catureArgs(tokens,index){
  
}

module.exports = {
  evaluateFile,
}

