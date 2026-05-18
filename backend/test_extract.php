<?php
$html = file_get_contents('https://docs.google.com/spreadsheets/d/1WR5qN8YY1hEJb5IYNKAU2xlq0yfg2UzXQjewVhQx0LE/htmlview');
preg_match('/\{"sheetId":.*?,"name":"(.*?)"\}/', $html, $m);
// actually there might be multiple sheets.
preg_match_all('/\{"sheetId":.*?,"name":"([^"]+)"\}/', $html, $matches);
print_r($matches[1]);
