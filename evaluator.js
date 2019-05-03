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

// function parseTokens(tokens){
  // var macro;
  // switch(tokens[0]){
    // case "if(":
      // macro = handleIf(tokens);
      // break;
    // case "id":
      // macro = gen.Column(tokens[0]);
      // break;
  // }
  // return macro;
// }

function groupStatements(tokens){
  var statements = [];

  for(var i = 0; i < tokens.length; i++){
    var operator;
    switch(tokens[i]){
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
        operator = tokens[i];
        continue;
      default:
        if(tokens[i].match(/^\".*\"$/)){
          statements.push(tokens[i].replace(/\"/g,""));
          break;
        }

        console.log(`I don't know what to do with this token: ${tokens[i]}`);
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

function captureIfStatement(tokens, index){
  tokens[0] = "(";
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

// HANDLERS

// function handleIf(parts){
//
  // var { startingIndex, endingIndex } = extractInternalsFromBrackets(parts,"(");
  // var condition = parts.slice(startingIndex,endingIndex).join('');
  // var {startingIndex,endingIndex} = extractInternalsFromBrackets(parts,"{",endingIndex);
  // var whenTrue = parseTokens(parts.slice(startingIndex,endingIndex));
//
  // var macro = gen.IfStatment(condition,whenTrue,"");
  // return macro;
// }

// HELPERS

function extractInternalsFromBrackets(parts, token, indexOffset = 0){
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
  var grouped = [], found;

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
  var grouped = [], index;
  for(var i = 0; i < tokens.length; i++){
    if(i == tokens.length - 1) superLog("last index");
    if(tokens[i].match(/^\s$/) || i == tokens.length - 1){
      if(index || index == 0){
        console.log(`slicing ${index} to ${i}`);
        var newTokens = divideTokens(tokens.slice(index,i).join(''));
        grouped.push(...newTokens);
      } else if(i == tokens.length - 1) {
        var newTokens = divideTokens(tokens[i]);
        grouped.push(...newTokens);
      }
      index = undefined;
    } else {
      if(!index && index != 0){
        console.log(`setting index: ${i}`)
        index = i;
      }
    }
  }
  return grouped;
}

function divideTokens(token){
  console.log(token);
  tokens = token.split(/(?<=[\(\[\{\}])|(?=[\)\]\}\{])/);
  console.log(tokens);
  return tokens
}

// function groupWords(parts){
  // var grouped = [], index;
  // for(var i = 0; i < parts.length; i++){
    // console.log(i)
    // if(parts[i].match(/^\w{1}$/)){
      // if(!index && index != 0){
        // console.log(`setting index: ${i}`)
        // index = i;
      // }
    // } else {
      // if(index || index == 0){
        // console.log(`slicing ${index} to ${i}`);
        // grouped.push(parts.slice(index,i).join(''));
      // }
      // grouped.push(parts[i]);
      // index = undefined;
    // }
  // }
  // return grouped;
// }

function parseError(parts){
  console.log("Parsing Error");
}

module.exports = {
  evaluateFile,
}


function superLog(msg){
  var p = "";
  for(var i = -4;i < msg.length; i++){p += "*"}
  console.log(`\n\t${p}\n\t* ${msg} *\n\t${p}\n`);
}
