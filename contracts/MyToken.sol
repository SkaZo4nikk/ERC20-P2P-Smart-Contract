// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PeerToPeerTransaction is ERC20 {

    uint256 public tokenPrice = 0.0001 ether;

    constructor()
        ERC20("PeerToPeerTransaction", "PTPT")
    {
        _mint(address(this), 10000 * 10 ** decimals());
    }

    function buyToken() public payable {
        uint256 tokenAmount = msg.value / tokenPrice; // Вычисляем количество токенов по цене
        require(tokenAmount <= balanceOf(address(this)), "Not enough tokens in the contract balance");
        _transfer(address(this), msg.sender, tokenAmount); // Переводим токены покупателю
    }

    function sellToken(uint256 tokenAmount) public payable {
        uint256 etherAmount = tokenAmount * tokenPrice; // Вычисляем сумму в эфирах за продажу токенов
        require(address(this).balance >= etherAmount, "Not enough ether on the contract balance");
        _transfer(msg.sender, address(this), tokenAmount); // Переводим токены контракту
        payable(msg.sender).transfer(etherAmount); // Переводим эфиры продавцу
    }
}