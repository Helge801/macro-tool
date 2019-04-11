
def collect_flags
  ARGV.select! do |f|
    if f.match(/^-{1,2}[^\-]+/) then
      case f
      when "-e"
        @extra_escape = true
      when "-E"
        @no_escape = true
      when "-v"
        @verbose = true
        puts "Set to verbose"
      else
        puts "Unknown flag: #{f}"
      end
      false
    else
      true
    end
  end
  command
end

def command
  return nil unless ARGV[0]
  arg = ARGV.shift
  case arg
  when "match"
    return match
  when "escape"
    return escape
  end
  return puts "Unknown command \"#{arg}\""
end

def match()
  c = "{product." + ARGV[0] + "}"
  s = ARGV[1].match(/^\//) ? ARGV[1].gsub(/^\/|\/$/,'') : ARGV[1]
  puts "Matching #{c} with #{s}" if @verbose
  sb = safe_match(s,/(^[^\(]*)/,1)
  sm = safe_match(s,/\(([^\)]+)/,1)
  se = safe_match(s,/\)(.*)/,1)
  puts "Pre capture: #{sb}" if @verbose
  puts "Capture: #{sm}" if @verbose
  puts "Post capture: #{se}" if @verbose
  b = mark_regex_par("(?<=#{sb})#{sm}[\\S\\s]*$")
  puts "End punchout marked: #{b}" if @verbose
  a = mark_regex_par("^[\\S\\s]*?#{sm}(?=#{se})")
  puts "Begining punchout marked: #{a}" if @verbose
  
  statement = "{replace(replace(regexp_replace(#{c},#{b},)),regexp_replace(#{c},#{a},),)}"
  puts "Un-escaped statement: #{statement}" if @verbose
  escaped_statement = escape_statement statement 
  puts "Escaped statment: #{escaped_statement}" if @verbose
  escaped_statement
end

def escape
  escape_statement ARGV[0]
end

def escape_statement(statement)
  puts "Skipping full escape" if @verbose && @no_escape
  return  puts statement.gsub("~",'') if @no_escape
  layer = @extra_escape ? 1 : 0
  skip = false
  parts = statement.split(//)
  parts = parts.map do |c|
    case c
    when "("
      layer += 1 unless skip
      skip = false
      escape_char(c,layer - 1)
    when ")"
      layer -= 1 unless skip
      skip = false
      escape_char(c,layer)
    when ","
      escape_char("(",layer - 1).gsub("(",c) 
    when ".","*","^","$","?","+"
      c
    when "~"
      skip = true
      c
    else
      escape_char(c,layer)
    end
    
  end

  puts parts.join.gsub("\~",'')
end

def escape_char(char, layer)
  return char if layer < 1
  layer.times do
    char = Regexp.escape(char)
  end
  return char
end

def replace(str,seg,new)
  str.sub(seg,new)
end

def regexp_replace(str,reg,new)
  str.sub(Regexp.new(reg),new)
end

def mark_regex_par(str)
  str.split('').map do |c|
    c == "(" || c == ")" ? "\~#{c}" : c
  end.join
end

def safe_match(str,reg,i)
  match = str.match(reg)
  if match then
    match = match[i]
  end
  match ? match : ""
end

# sku = "F12345DFG23"
# puts sku.match(/(\D*\d+)/)
# before = sku.gsub(/\D*\d+[\S\s]*?$/,"")
# puts "before: " + before
# after = sku.gsub(/^[\S\s]*?(\D*\d+)/,"")
# puts "after: " + after
# sku = sku.gsub(before,"").gsub(after,"")
# puts sku



# statement = ARGV[0] || "id.match()"
# translate_statment

# escape_statement ARGV[0]

# translate_statment

# command

collect_flags
