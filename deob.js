/* eslint-disable max-len */
/* eslint-disable no-console */
const esprima = require('esprima');
const escodegen = require('escodegen');
const estraverse = require('estraverse');

/*
  Disclaimer: This was threw together out of an older project to filll specific needs. The code is not clean, but help yourself :) 

*/
const fs = require('fs');

const { ArgumentParser } = require('argparse');
// const {deobfuscate} = require('./deobfuscate'); // uncomment this for array support. 

/**
 * Parses the arguments and returns them as an object
 * @returns
 */
function initArgs() {
  const parser = new ArgumentParser({
    prog: 'main.js',
    description: 'strela js deobduscation tool',
  });

  parser.add_argument('input_file', { help: 'file to read' });
  parser.add_argument('output_file', { help: 'file to write' });

  return parser.parse_args();
}

/**
 * Reads the input file and returns its content
 * If the input file cannot be read, it returns null
 *
 * @param {*} inputFile
 * @returns
 */
function readFile(inputFile) {
  try {
    return fs.readFileSync(inputFile, 'utf8');
  } catch (err) {
    throw new Error(`Could not read file ${inputFile}: ${err}`);
  }
}

function transformArrayToString(code) {
  // Parse the code into an AST
  const ast = esprima.parseScript(code);
  
  // Find all variable declarations that initialize arrays
  const arrayDeclarations = new Map();
  
  // First pass: collect all array initializations
  estraverse.traverse(ast, {
      enter: function(node) {
          if (node.type === 'ExpressionStatement' &&
              node.expression &&
              node.expression.type === 'AssignmentExpression' &&
              node.expression.left &&
              node.expression.right &&
              node.expression.left.type == 'Identifier' &&
              node.expression.right.type == 'ArrayExpression') {
              console.log(`Array found: ${node.expression.left.name}`)
              arrayDeclarations.set(node.expression.left.name, {});
          }
      }
  });
  
  // Second pass: collect array assignments
  estraverse.traverse(ast, {
      enter: function(node) {
          if (node.type === 'AssignmentExpression' &&
              node.left.type === 'MemberExpression' &&
              node.left.computed === true) {
              
              const arrayName = node.left.object.name;
              if (arrayDeclarations.has(arrayName)) {
                  const key = node.left.property.value;
                  const value = node.right.value;
                  arrayDeclarations.get(arrayName)[key] = value;
              }
          }
      }
  });
  
  // Third pass: transform concatenations
  estraverse.replace(ast, {
      enter: function(node) {
          if (node.type === 'BinaryExpression' && node.operator === '+') {
              // Collect all parts of the concatenation
              const parts = collectConcatenationParts(node);
              
              // Check if all parts are array member accesses or literal
              const arrayAccesses = parts.every(part => 
                  (part.type === 'MemberExpression' &&
                  part.computed === true &&
                  arrayDeclarations.has(part.object.name))
                  ||
                  part.type == 'Literal'
              );
              
              if (arrayAccesses) {
                  // Build the final string
                  const resultString = parts.map(part => {
                      if (part.type == 'Literal') {
                        return part.value
                      }
                      const arrayName = part.object.name;
                      const key = part.property.value;
                      return arrayDeclarations.get(arrayName)[key];
                  }).join('');
                  
                  // Return new string literal node
                  return {
                      type: 'Literal',
                      value: resultString,
                      raw: `'${resultString}'`
                  };
              }
          }
      }
  });
 
// Fourth pass: remove unused arrays
    function removeUnusedArrays(ast) {
        // Track which arrays are still being used
        const usedArrays = new Set();
        
        // First 
        estraverse.replace(ast, {
            leave: function(node) {
              if (node.type === 'ExpressionStatement' &&
                node.expression &&
                node.expression.type === 'AssignmentExpression' &&
                node.expression.left &&
                node.expression.right &&
                node.expression.left.type == 'Identifier' &&
                node.expression.right.type == 'ArrayExpression' &&
                arrayDeclarations.has(node.expression.left.name)){
                  return null
                }
                return node
            }
        });

        estraverse.replace(ast, {
          leave: function(node) {
            if (node.type === 'ExpressionStatement' &&
              node.expression &&
              node.expression.type === 'AssignmentExpression' &&
              node.expression.left &&
              node.expression.right &&
              node.expression.left.type == 'MemberExpression' &&
              node.expression.left.object && 
              node.expression.left.object.name &&
              arrayDeclarations.has(node.expression.left.object.name)) {
                return null
              }
              return node
          }
      });      
        
        
        ast.body = ast.body.filter(item => item !== null);
        return ast;
    }
    
    // Apply the cleanup
    const cleanedAst = removeUnusedArrays(ast);

  // Generate the transformed code
  return escodegen.generate(ast);
}

// Helper function to collect all parts of a concatenation
function collectConcatenationParts(node) {
  if (node.type !== 'BinaryExpression' || node.operator !== '+') {
      return [node];
  }
  
  return [
      ...collectConcatenationParts(node.left),
      ...collectConcatenationParts(node.right)
  ];
}

if (require.main === module) {
  const args = initArgs();

  // args = {
  //   'input_file': 'app/tmp/241113-gwz66arr9t_pw_infected/245020524171535190.js.bak',
  //   'output_file' : 'strela_out.js'
  // }

  try {
    const code = readFile(args.input_file);

    const deobfuscated = transformArrayToString(code)

    console.log(`Writing result to file ${args.output_file}`);
    fs.writeFileSync(args.output_file, deobfuscated, (err) => {
      throw new Error(`Could not write to file: ${err}`);
    });

  } catch (err) {
    console.log(err)
  }
}

