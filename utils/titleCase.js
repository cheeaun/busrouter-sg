module.exports = function(str){
  return str.replace(/\w\S*/g, (s) =>  s.charAt(0).toUpperCase() + s.substr(1).toLowerCase());
}