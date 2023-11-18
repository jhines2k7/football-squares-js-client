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
  domain="146.190.72.89:8000"
else
  echo "Invalid environment specified. Please use 'prod', 'test', or 'dev'."
  exit 1
fi

if [ -d "dist" ]; then
  rm -r dist
fi

# Path to the JavaScript file
js_file="main.js"

# Path to your HTML file
html_file="index.html"

# Directory to store the new file
dist_folder="dist"

# Create the dist folder if it doesn't exist
mkdir -p $dist_folder

# Generate a hash of the JavaScript file
filehash=$(md5sum $js_file | cut -d ' ' -f 1)

# New JavaScript file name with hash in the dist folder
new_js_file="$dist_folder/$(basename $js_file .js)-${filehash}.js"

# Copy the JavaScript file to the new location with the new name
cp $js_file $new_js_file

# Copy all .css files to the dist folder
cp *.css $dist_folder

# Copy the fonts folder to the dist folder
# cp -r fonts $dist_folder

# Copy the HTML file to the dist folder
cp $html_file $dist_folder

# Update the HTML file in the dist folder with the new JavaScript file name and domain
sed -i 's|'$(basename $js_file)'|'$(basename $new_js_file)'|g' $dist_folder/$html_file
sed -i 's|http://localhost:8000|http://'"$domain"'|g' $new_js_file

echo "Cache busting done. JS file copied to dist and HTML reference updated."