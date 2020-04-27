import { getCustomRepository, getRepository, In } from 'typeorm';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import loadCSV from '../util/loadCSV';
import TransactionsRepository from '../repositories/TransactionsRepository';
import CreateTransactionService from './CreateTransactionService';

interface Requestii {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class ImportTransactionsService {
  async execute(csvFilePath: string): Promise<Transaction[]> {
    const lines = await loadCSV(csvFilePath);
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoryRepository = getRepository(Category);

    const transactionsRawRequests = lines.map(line => {
      return {
        title: line[0],
        type: line[1],
        value: line[2],
        category: line[3],
      };
    });

    const categoriesTitles: string[] = transactionsRawRequests
      .map(transaction => transaction.category)
      .reduce(
        (unique, item) => (unique.includes(item) ? unique : [...unique, item]),
        [],
      );

    const categoriesInBd = await categoryRepository.find({
      where: {
        title: In(categoriesTitles),
      },
    });

    const categoriesTitlesInBd = categoriesInBd.map(
      categories => categories.title,
    );

    const categoriesTitlesNotInBd = categoriesTitles
      .filter(category => !categoriesTitlesInBd.includes(category))
      .map(category => {
        return { title: category };
      });

    const newCategories = categoryRepository.create(categoriesTitlesNotInBd);
    await categoryRepository.save(newCategories);

    const categories = [...categoriesInBd, ...newCategories];

    const transactionsRequests = transactionsRawRequests.map(transaction => {
      const category_id = categories.find(
        category => category.title === transaction.category,
      );

      return {
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category_id: category_id?.id,
      };
    });

    const transactions = transactionsRepository.create(transactionsRequests);
    await transactionsRepository.save(transactions);

    console.log(transactions);
    return transactions;
  }
}

export default ImportTransactionsService;
