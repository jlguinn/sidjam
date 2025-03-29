CREATE TABLE alltunes (
    id INT PRIMARY KEY,
    fullpath VARCHAR(255) NOT NULL,
    INDEX idx_fullpath (fullpath)
);

CREATE TABLE sidjam (
    vote_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    id INT NOT NULL,
    win INT DEFAULT 0,
    loss INT DEFAULT 0,
    UNIQUE KEY uk_user_song (user_id, id)
);

CREATE TABLE siduser (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    UserName VARCHAR(50) NOT NULL,
    session_id VARCHAR(32) NOT NULL UNIQUE,
    RegDate DATE NOT NULL,
    LastAccessDate DATE NOT NULL
);