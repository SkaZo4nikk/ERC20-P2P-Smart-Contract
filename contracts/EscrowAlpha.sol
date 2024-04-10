// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EscrowContract is Ownable {

    struct Deal {
        address garant; //Тот кто развернул контракт
        address client; 
        address implementer; 
        IERC20 token;
        uint256 transactionAmount; //Стоимость заказа
        bool dealCompleted;
        bool fundsDeposited; //Удержание токенов
    }

    mapping(uint256 => Deal) public deals;

    constructor() Ownable(msg.sender) {}

    function createDeal(uint256 _dealid, address client, address implementer, IERC20 token, uint256 transactionAmount) external onlyOwner {
        uint256 dealId = _dealid;
        deals[dealId] = Deal(msg.sender, client, implementer, token, transactionAmount, false, false);
    }

    function depositTokens(uint256 dealId) external onlyOwner {
        Deal storage deal = deals[dealId];
        require(deal.token.transferFrom(msg.sender, address(this), deal.transactionAmount), "Token transfer failed"); //Дать approve на адрес токена
        deal.fundsDeposited = true;
    }

    function completeDeal(uint256 dealId) external onlyOwner {
        Deal storage deal = deals[dealId];
        require(!deal.dealCompleted, "Deal is already completed.");
        require(deal.token.transfer(deal.implementer, deal.transactionAmount), "Token transfer failed");
        deal.dealCompleted = true;
    }

    function denyDeal(uint256 dealId) external onlyOwner {
        Deal storage deal = deals[dealId];
        //require(deal.fundsDeposited, "No funds deposited for this deal");

        if(!deal.fundsDeposited){
            deal.dealCompleted = true;
        }
        else {
            require(!deal.dealCompleted, "Deal is already completed");

            deal.dealCompleted = true;
            uint256 refundAmount = deal.transactionAmount;
            deal.fundsDeposited = false;

            require(deal.token.transfer(deal.client, refundAmount), "Refund failed");
        }
    }

    function finalizeDeal(uint256 dealId, uint256 implementerPercentage) external onlyOwner {
        Deal storage deal = deals[dealId];
        require(deal.fundsDeposited, "No funds deposited for this deal");
        require(!deal.dealCompleted, "Deal is already completed");

        deal.dealCompleted = true; 
        uint256 implementerAmount = deal.transactionAmount * implementerPercentage / 100;
        uint256 clientRefund = deal.transactionAmount - implementerAmount;

        require(deal.token.transfer(deal.implementer, implementerAmount), "Transfer to implementer failed");
        if (clientRefund > 0) {
            require(deal.token.transfer(deal.client, clientRefund), "Refund to client failed");
        }
    }
}