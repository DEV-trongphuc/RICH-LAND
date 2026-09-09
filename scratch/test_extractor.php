<?php
header('Content-Type: application/json; charset=utf-8');

$result = [
    'phar_available' => class_exists('PharData'),
    'zip_available' => class_exists('ZipArchive'),
    'current_dir' => __DIR__,
    'files' => scandir(__DIR__)
];

echo json_encode($result, JSON_PRETTY_PRINT);
