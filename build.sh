#!/bin/bash

# Parse commandline arguments
while [[ $# -gt 0 ]]
do
key="$1"

case $key in
    -e|--environment)
    environment="$2"
    shift # past argument
    shift # past value
    ;;
    *)    # unknown option
    shift # past argument
    ;;
esac
done

# Set domain based on environment
if [ "$environment" == "prod" ]; then
  domain="prod.wss1.crypto-rockpaperscissors.com"
elif [ "$environment" == "test" ]; then
  domain="test.wss1.crypto-rockpaperscissors.com"
elif [ "$environment" == "dev" ]; then
  domain="fs.generalsolutions43.com"
else
  echo "Invalid environment specified. Please use 'prod', 'test', or 'dev'."
  exit 1
fi

if [ -d "dist" ]; then
  rm -r dist
fi

# Path to the JavaScript file
js_file="main.js"
css_file="styles.css"

# Path to your HTML file
html_file="index.html"

# Directory to store the new file
dist_folder="dist"

# Create the dist folder if it doesn't exist
mkdir -p $dist_folder

# Generate a hash of the JavaScript file
filehash=$(md5sum $js_file | cut -d ' ' -f 1)
csshash=$(md5sum $css_file | cut -d ' ' -f 1)

# New JavaScript file name with hash in the dist folder
new_js_file="$dist_folder/$(basename $js_file .js)-${filehash}.js"
new_css_file="$dist_folder/$(basename $css_file .css)-${csshash}.css"

# Copy the JavaScript file to the new location with the new name
cp $js_file $new_js_file
cp $css_file $new_css_file

# Copy all .css files to the dist folder
cp *.css $dist_folder
cp -r lib $dist_folder

# Copy the fonts folder to the dist folder
# cp -r fonts $dist_folder

# Handle the templates directory
if [ -d "templates" ]; then
  cp -r templates $dist_folder/templates
  for file in templates/*; do
    if [ -f "$file" ]; then
      filehash=$(md5sum $file | cut -d ' ' -f 1)
      newfilename="$(basename $file .html)-${filehash}.html"
      mv "$dist_folder/templates/$(basename $file)" "$dist_folder/templates/$newfilename"

      # Update reference in main.js
      sed -i 's|'$(basename $file)'|'$newfilename'|g' $new_js_file
    fi
  done
fi

# Copy the templates folder to the dist folder
# cp -r templates $dist_folder
cp -r team_logos $dist_folder

# Copy the HTML file to the dist folder
cp $html_file $dist_folder

rm $dist_folder/$css_file

# Update the HTML file in the dist folder with the new JavaScript file name and domain
sed -i 's|'$(basename $js_file)'|'$(basename $new_js_file)'|g' $dist_folder/$html_file
sed -i 's|'$(basename $css_file)'|'$(basename $new_css_file)'|g' $dist_folder/$html_file
sed -i 's|http://localhost:8000|https://'"$domain"'|g' $new_js_file

echo "Cache busting done. JS file copied to dist and HTML reference updated."