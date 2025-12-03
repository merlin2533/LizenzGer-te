<?php
header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 1);

$info = [
    'status' => 'ok',
    'php_version' => phpversion(),
    'sqlite3_extension' => class_exists('SQLite3'),
    'pdo_class' => class_exists('PDO'),
    'pdo_drivers' => class_exists('PDO') ? PDO::getAvailableDrivers() : [],
    'pdo_sqlite' => class_exists('PDO') && in_array('sqlite', PDO::getAvailableDrivers()),
    'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown'
];
echo json_encode($info, JSON_PRETTY_PRINT);
?>
