using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using Microsoft.VisualBasic;

namespace TranslatorEngine;

public class TranslatorEngine
{
	public const int CHINESE_LOOKUP_MAX_LENGTH = 20;

	private static bool dictionaryDirty = true;

	private static Dictionary<string, string> hanVietDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> vietPhraseDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> thieuChuuDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> lacVietDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> cedictDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> chinesePhienAmEnglishDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> vietPhraseOneMeaningDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> onlyVietPhraseDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> onlyNameDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> onlyNameOneMeaningDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> onlyNameChinhDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> onlyNamePhuDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> luatNhanDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> pronounDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> pronounOneMeaningDictionary = new Dictionary<string, string>();

	private static Dictionary<string, string> nhanByDictionary = null;

	private static Dictionary<string, string> nhanByOneMeaningDictionary = null;

	private static DataSet onlyVietPhraseDictionaryHistoryDataSet = new DataSet();

	private static DataSet onlyNameDictionaryHistoryDataSet = new DataSet();

	private static DataSet onlyNamePhuDictionaryHistoryDataSet = new DataSet();

	private static DataSet hanVietDictionaryHistoryDataSet = new DataSet();

	private static List<string> ignoredChinesePhraseList = new List<string>();

	private static List<string> ignoredChinesePhraseForBrowserList = new List<string>();

	private static object lockObject = new object();

	private static string NULL_STRING = Convert.ToChar(0).ToString();

	public static string LastTranslatedWord_HanViet = "";

	public static string LastTranslatedWord_VietPhrase = "";

	public static string LastTranslatedWord_VietPhraseOneMeaning = "";

	private static char[] trimCharsForAnalyzer = new char[3] { ' ', '\n', '\t' };

	public static bool DictionaryDirty
	{
		get
		{
			return dictionaryDirty;
		}
		set
		{
			dictionaryDirty = value;
		}
	}

	public static string GetVietPhraseOrNameValueFromKey(string key)
	{
		if (!vietPhraseDictionary.ContainsKey(key))
		{
			return null;
		}
		return vietPhraseDictionary[key];
	}

	public static string GetVietPhraseValueFromKey(string key)
	{
		if (!onlyVietPhraseDictionary.ContainsKey(key))
		{
			return null;
		}
		return onlyVietPhraseDictionary[key];
	}

	public static string GetNameValueFromKey(string key)
	{
		if (!onlyNameDictionary.ContainsKey(key))
		{
			return null;
		}
		return onlyNameDictionary[key];
	}

	public static string GetNameValueFromKey(string key, bool isNameChinh)
	{
		Dictionary<string, string> dictionary = (isNameChinh ? onlyNameChinhDictionary : onlyNamePhuDictionary);
		if (!dictionary.ContainsKey(key))
		{
			return null;
		}
		return dictionary[key];
	}

	public static void DeleteKeyFromVietPhraseDictionary(string key, bool sorting)
	{
		vietPhraseDictionary.Remove(key);
		vietPhraseOneMeaningDictionary.Remove(key);
		onlyVietPhraseDictionary.Remove(key);
		if (sorting)
		{
			SaveDictionaryToFile(ref onlyVietPhraseDictionary, DictionaryConfigurationHelper.GetVietPhraseDictionaryPath());
		}
		else
		{
			SaveDictionaryToFileWithoutSorting(onlyVietPhraseDictionary, DictionaryConfigurationHelper.GetVietPhraseDictionaryPath());
		}
		writeVietPhraseHistoryLog(key, "Deleted");
	}

	public static void DeleteKeyFromNameDictionary(string key, bool sorting, bool isNameChinh)
	{
		vietPhraseDictionary.Remove(key);
		vietPhraseOneMeaningDictionary.Remove(key);
		onlyNameDictionary.Remove(key);
		onlyNameOneMeaningDictionary.Remove(key);
		Dictionary<string, string> dictionary = (isNameChinh ? onlyNameChinhDictionary : onlyNamePhuDictionary);
		if (dictionary.ContainsKey(key))
		{
			dictionary.Remove(key);
			if (sorting)
			{
				SaveDictionaryToFile(ref dictionary, isNameChinh ? DictionaryConfigurationHelper.GetNamesDictionaryPath() : DictionaryConfigurationHelper.GetNamesPhuDictionaryPath());
			}
			else
			{
				SaveDictionaryToFileWithoutSorting(dictionary, isNameChinh ? DictionaryConfigurationHelper.GetNamesDictionaryPath() : DictionaryConfigurationHelper.GetNamesPhuDictionaryPath());
			}
			writeNamesHistoryLog(key, "Deleted", isNameChinh);
		}
	}

	public static void DeleteKeyFromPhienAmDictionary(string key, bool sorting)
	{
		hanVietDictionary.Remove(key);
		if (sorting)
		{
			SaveDictionaryToFile(ref hanVietDictionary, DictionaryConfigurationHelper.GetChinesePhienAmWordsDictionaryPath());
		}
		else
		{
			SaveDictionaryToFileWithoutSorting(hanVietDictionary, DictionaryConfigurationHelper.GetChinesePhienAmWordsDictionaryPath());
		}
		writePhienAmHistoryLog(key, "Deleted");
	}

	public static void UpdateVietPhraseDictionary(string key, string value, bool sorting)
	{
		if (vietPhraseDictionary.ContainsKey(key))
		{
			vietPhraseDictionary[key] = value;
		}
		else
		{
			vietPhraseDictionary.Add(key, value);
		}
		if (vietPhraseOneMeaningDictionary.ContainsKey(key))
		{
			vietPhraseOneMeaningDictionary[key] = value.Split('/', '|')[0];
		}
		else
		{
			vietPhraseOneMeaningDictionary.Add(key, value.Split('/', '|')[0]);
		}
		if (onlyVietPhraseDictionary.ContainsKey(key))
		{
			onlyVietPhraseDictionary[key] = value;
			writeVietPhraseHistoryLog(key, "Updated");
		}
		else
		{
			if (sorting)
			{
				onlyVietPhraseDictionary.Add(key, value);
			}
			else
			{
				onlyVietPhraseDictionary = AddEntryToDictionaryWithoutSorting(onlyVietPhraseDictionary, key, value);
			}
			writeVietPhraseHistoryLog(key, "Added");
		}
		if (sorting)
		{
			SaveDictionaryToFile(ref onlyVietPhraseDictionary, DictionaryConfigurationHelper.GetVietPhraseDictionaryPath());
		}
		else
		{
			SaveDictionaryToFileWithoutSorting(onlyVietPhraseDictionary, DictionaryConfigurationHelper.GetVietPhraseDictionaryPath());
		}
	}

	private static Dictionary<string, string> AddEntryToDictionaryWithoutSorting(Dictionary<string, string> dictionary, string key, string value)
	{
		Dictionary<string, string> dictionary2 = new Dictionary<string, string>();
		foreach (KeyValuePair<string, string> item in dictionary)
		{
			dictionary2.Add(item.Key, item.Value);
		}
		dictionary2.Add(key, value);
		return dictionary2;
	}

	public static void UpdateNameDictionary(string key, string value, bool sorting, bool isNameChinh)
	{
		if (vietPhraseDictionary.ContainsKey(key))
		{
			vietPhraseDictionary[key] = value;
		}
		else
		{
			vietPhraseDictionary.Add(key, value);
		}
		if (vietPhraseOneMeaningDictionary.ContainsKey(key))
		{
			vietPhraseOneMeaningDictionary[key] = value.Split('/', '|')[0];
		}
		else
		{
			vietPhraseOneMeaningDictionary.Add(key, value.Split('/', '|')[0]);
		}
		Dictionary<string, string> dictionary = (isNameChinh ? onlyNameChinhDictionary : onlyNamePhuDictionary);
		if (dictionary.ContainsKey(key))
		{
			dictionary[key] = value;
			writeNamesHistoryLog(key, "Updated", isNameChinh);
		}
		else
		{
			if (sorting)
			{
				dictionary.Add(key, value);
			}
			else if (isNameChinh)
			{
				onlyNameChinhDictionary = AddEntryToDictionaryWithoutSorting(onlyNameChinhDictionary, key, value);
				dictionary = onlyNameChinhDictionary;
			}
			else
			{
				onlyNamePhuDictionary = AddEntryToDictionaryWithoutSorting(onlyNamePhuDictionary, key, value);
				dictionary = onlyNamePhuDictionary;
			}
			writeNamesHistoryLog(key, "Added", isNameChinh);
		}
		if (onlyNameDictionary.ContainsKey(key))
		{
			onlyNameDictionary[key] = value;
			onlyNameOneMeaningDictionary[key] = value.Split('/', '|')[0];
		}
		else if (sorting)
		{
			onlyNameDictionary.Add(key, value);
			onlyNameOneMeaningDictionary.Add(key, value.Split('/', '|')[0]);
		}
		else
		{
			onlyNameDictionary = AddEntryToDictionaryWithoutSorting(onlyNameDictionary, key, value);
			onlyNameOneMeaningDictionary = AddEntryToDictionaryWithoutSorting(onlyNameOneMeaningDictionary, key, value.Split('/', '|')[0]);
		}
		if (sorting)
		{
			SaveDictionaryToFile(ref dictionary, isNameChinh ? DictionaryConfigurationHelper.GetNamesDictionaryPath() : DictionaryConfigurationHelper.GetNamesPhuDictionaryPath());
		}
		else
		{
			SaveDictionaryToFileWithoutSorting(dictionary, isNameChinh ? DictionaryConfigurationHelper.GetNamesDictionaryPath() : DictionaryConfigurationHelper.GetNamesPhuDictionaryPath());
		}
	}

	public static void UpdatePhienAmDictionary(string key, string value, bool sorting)
	{
		if (hanVietDictionary.ContainsKey(key))
		{
			hanVietDictionary[key] = value;
			writePhienAmHistoryLog(key, "Updated");
		}
		else
		{
			if (sorting)
			{
				hanVietDictionary.Add(key, value);
			}
			else
			{
				hanVietDictionary = AddEntryToDictionaryWithoutSorting(hanVietDictionary, key, value);
			}
			writePhienAmHistoryLog(key, "Added");
		}
		if (sorting)
		{
			SaveDictionaryToFile(ref hanVietDictionary, DictionaryConfigurationHelper.GetChinesePhienAmWordsDictionaryPath());
		}
		else
		{
			SaveDictionaryToFileWithoutSorting(hanVietDictionary, DictionaryConfigurationHelper.GetChinesePhienAmWordsDictionaryPath());
		}
	}

	public static void SaveDictionaryToFileWithoutSorting(Dictionary<string, string> dictionary, string filePath)
	{
		string text = filePath + "." + DateTime.Now.Ticks;
		if (File.Exists(filePath))
		{
			File.Copy(filePath, text, overwrite: true);
		}
		StringBuilder stringBuilder = new StringBuilder();
		foreach (KeyValuePair<string, string> item in dictionary)
		{
			stringBuilder.Append(item.Key).Append("=").AppendLine(item.Value);
		}
		try
		{
			File.WriteAllText(filePath, stringBuilder.ToString(), Encoding.UTF8);
		}
		catch (Exception ex)
		{
			try
			{
				File.Copy(text, filePath, overwrite: true);
			}
			catch
			{
			}
			throw ex;
		}
		if (File.Exists(filePath))
		{
			File.Delete(text);
		}
	}

	public static void SaveDictionaryToFile(ref Dictionary<string, string> dictionary, string filePath)
	{
		IOrderedEnumerable<KeyValuePair<string, string>> orderedEnumerable = from pair in dictionary
			orderby pair.Key.Length descending, pair.Key
			select pair;
		Dictionary<string, string> dictionary2 = new Dictionary<string, string>();
		string text = filePath + "." + DateTime.Now.Ticks;
		if (File.Exists(filePath))
		{
			File.Copy(filePath, text, overwrite: true);
		}
		StringBuilder stringBuilder = new StringBuilder();
		foreach (KeyValuePair<string, string> item in orderedEnumerable)
		{
			stringBuilder.Append(item.Key).Append("=").AppendLine(item.Value);
			dictionary2.Add(item.Key, item.Value);
		}
		dictionary = dictionary2;
		try
		{
			File.WriteAllText(filePath, stringBuilder.ToString(), Encoding.UTF8);
		}
		catch (Exception ex)
		{
			try
			{
				File.Copy(text, filePath, overwrite: true);
			}
			catch
			{
			}
			throw ex;
		}
		if (File.Exists(filePath))
		{
			File.Delete(text);
		}
	}

	public static string ChineseToHanViet(string chinese, out CharRange[] chineseHanVietMappingArray)
	{
		LastTranslatedWord_HanViet = "";
		List<CharRange> list = new List<CharRange>();
		StringBuilder stringBuilder = new StringBuilder();
		int length = chinese.Length;
		for (int i = 0; i < length - 1; i++)
		{
			int startIndexOfNextTranslatedText = stringBuilder.ToString().Length;
			char c = chinese[i];
			char character = chinese[i + 1];
			if (isChinese(c))
			{
				if (isChinese(character))
				{
					appendTranslatedWord(stringBuilder, ChineseToHanViet(c), ref LastTranslatedWord_HanViet, ref startIndexOfNextTranslatedText);
					stringBuilder.Append(" ");
					LastTranslatedWord_HanViet += " ";
					list.Add(new CharRange(startIndexOfNextTranslatedText, ChineseToHanViet(c).Length));
				}
				else
				{
					appendTranslatedWord(stringBuilder, ChineseToHanViet(c), ref LastTranslatedWord_HanViet, ref startIndexOfNextTranslatedText);
					list.Add(new CharRange(startIndexOfNextTranslatedText, ChineseToHanViet(c).Length));
				}
			}
			else
			{
				stringBuilder.Append(c);
				LastTranslatedWord_HanViet += c;
				list.Add(new CharRange(startIndexOfNextTranslatedText, 1));
			}
		}
		if (isChinese(chinese[length - 1]))
		{
			appendTranslatedWord(stringBuilder, ChineseToHanViet(chinese[length - 1]), ref LastTranslatedWord_HanViet);
			list.Add(new CharRange(stringBuilder.ToString().Length, ChineseToHanViet(chinese[length - 1]).Length));
		}
		else
		{
			stringBuilder.Append(chinese[length - 1]);
			LastTranslatedWord_HanViet += chinese[length - 1];
			list.Add(new CharRange(stringBuilder.ToString().Length, 1));
		}
		chineseHanVietMappingArray = list.ToArray();
		LastTranslatedWord_HanViet = "";
		return stringBuilder.ToString();
	}

	public static string ChineseToHanVietForBrowser(string chinese)
	{
		if (string.IsNullOrEmpty(chinese))
		{
			return "";
		}
		chinese = StandardizeInputForBrowser(chinese);
		StringBuilder stringBuilder = new StringBuilder();
		string[] array = classifyWordsIntoLatinAndChinese(chinese);
		int num = array.Length;
		for (int i = 0; i < num; i++)
		{
			string text = array[i];
			if (string.IsNullOrEmpty(text))
			{
				continue;
			}
			string text2;
			if (isChinese(text[0]))
			{
				text2 = ChineseToHanViet(text, out var _).TrimStart();
				if (i == 0 || !array[i - 1].EndsWith(", "))
				{
					text2 = toUpperCase(text2);
				}
			}
			else
			{
				text2 = text;
			}
			stringBuilder.Append(text2);
		}
		return stringBuilder.ToString();
	}

	public static string ChineseToHanVietForBatch(string chinese)
	{
		string lastTranslatedWord = "";
		StringBuilder stringBuilder = new StringBuilder();
		int length = chinese.Length;
		for (int i = 0; i < length - 1; i++)
		{
			char c = chinese[i];
			char character = chinese[i + 1];
			if (isChinese(c))
			{
				if (isChinese(character))
				{
					appendTranslatedWord(stringBuilder, ChineseToHanViet(c), ref lastTranslatedWord);
					stringBuilder.Append(" ");
					lastTranslatedWord += " ";
				}
				else
				{
					appendTranslatedWord(stringBuilder, ChineseToHanViet(c), ref lastTranslatedWord);
				}
			}
			else
			{
				stringBuilder.Append(c);
				lastTranslatedWord += c;
			}
		}
		if (isChinese(chinese[length - 1]))
		{
			appendTranslatedWord(stringBuilder, ChineseToHanViet(chinese[length - 1]), ref lastTranslatedWord);
		}
		else
		{
			stringBuilder.Append(chinese[length - 1]);
			lastTranslatedWord += chinese[length - 1];
		}
		return stringBuilder.ToString();
	}

	public static string ChineseToHanViet(char chinese)
	{
		if (chinese == ' ')
		{
			return "";
		}
		if (!hanVietDictionary.ContainsKey(chinese.ToString()))
		{
			return ToNarrow(chinese.ToString());
		}
		return hanVietDictionary[chinese.ToString()];
	}

	public static string ChineseToVietPhrase(string chinese, int wrapType, int translationAlgorithm, bool prioritizedName, out CharRange[] chinesePhraseRanges, out CharRange[] vietPhraseRanges)
	{
		LastTranslatedWord_VietPhrase = "";
		List<CharRange> list = new List<CharRange>();
		List<CharRange> list2 = new List<CharRange>();
		StringBuilder stringBuilder = new StringBuilder();
		int num = chinese.Length - 1;
		int num2 = 0;
		int num3 = -1;
		int num4 = -1;
		int num5 = -1;
		loadNhanByDictionary();
		while (num2 <= num)
		{
			bool flag = false;
			bool flag2 = true;
			for (int num6 = 20; num6 > 0; num6--)
			{
				if (chinese.Length >= num2 + num6)
				{
					if (vietPhraseDictionary.ContainsKey(chinese.Substring(num2, num6)))
					{
						if ((!prioritizedName || !containsName(chinese, num2, num6)) && ((translationAlgorithm != 0 && translationAlgorithm != 2) || isLongestPhraseInSentence(chinese, num2, num6, vietPhraseDictionary, translationAlgorithm) || (prioritizedName && onlyNameDictionary.ContainsKey(chinese.Substring(num2, num6)))))
						{
							list.Add(new CharRange(num2, num6));
							switch (wrapType)
							{
							case 0:
								appendTranslatedWord(stringBuilder, vietPhraseDictionary[chinese.Substring(num2, num6)], ref LastTranslatedWord_VietPhrase);
								list2.Add(new CharRange(stringBuilder.ToString().Length - vietPhraseDictionary[chinese.Substring(num2, num6)].Length, vietPhraseDictionary[chinese.Substring(num2, num6)].Length));
								break;
							case 1:
							case 11:
								appendTranslatedWord(stringBuilder, "[" + vietPhraseDictionary[chinese.Substring(num2, num6)] + "]", ref LastTranslatedWord_VietPhrase);
								list2.Add(new CharRange(stringBuilder.ToString().Length - vietPhraseDictionary[chinese.Substring(num2, num6)].Length - 2, vietPhraseDictionary[chinese.Substring(num2, num6)].Length + 2));
								break;
							default:
								if (hasOnlyOneMeaning(vietPhraseDictionary[chinese.Substring(num2, num6)]))
								{
									appendTranslatedWord(stringBuilder, vietPhraseDictionary[chinese.Substring(num2, num6)], ref LastTranslatedWord_VietPhrase);
									list2.Add(new CharRange(stringBuilder.ToString().Length - vietPhraseDictionary[chinese.Substring(num2, num6)].Length, vietPhraseDictionary[chinese.Substring(num2, num6)].Length));
								}
								else
								{
									appendTranslatedWord(stringBuilder, "[" + vietPhraseDictionary[chinese.Substring(num2, num6)] + "]", ref LastTranslatedWord_VietPhrase);
									list2.Add(new CharRange(stringBuilder.ToString().Length - vietPhraseDictionary[chinese.Substring(num2, num6)].Length - 2, vietPhraseDictionary[chinese.Substring(num2, num6)].Length + 2));
								}
								break;
							}
							if (nextCharIsChinese(chinese, num2 + num6 - 1))
							{
								stringBuilder.Append(" ");
								LastTranslatedWord_VietPhrase += " ";
							}
							flag = true;
							num2 += num6;
							break;
						}
					}
					else if (!chinese.Substring(num2, num6).Contains("\n") && !chinese.Substring(num2, num6).Contains("\t") && nhanByDictionary != null && flag2 && 2 < num6 && num3 < num2 + num6 - 1 && IsAllChinese(chinese.Substring(num2, num6)))
					{
						if (num2 < num4)
						{
							if (num4 < num2 + num6 && num6 <= num5 - num4)
							{
								num6 = num4 - num2 + 1;
							}
						}
						else
						{
							string luatNhan = string.Empty;
							int matchedLength = -1;
							int num7 = containsLuatNhan(chinese.Substring(num2, num6), nhanByDictionary, out luatNhan, out matchedLength);
							num4 = num2 + num7;
							num5 = num4 + matchedLength;
							if (num7 == 0)
							{
								if (isLongestPhraseInSentence(chinese, num2 - 1, matchedLength - 1, vietPhraseOneMeaningDictionary, translationAlgorithm))
								{
									num6 = matchedLength;
									list.Add(new CharRange(num2, num6));
									string text = ChineseToLuatNhan(chinese.Substring(num2, num6), nhanByDictionary);
									switch (wrapType)
									{
									case 0:
										appendTranslatedWord(stringBuilder, text, ref LastTranslatedWord_VietPhrase);
										list2.Add(new CharRange(stringBuilder.ToString().Length - text.Length, text.Length));
										break;
									case 1:
									case 11:
										appendTranslatedWord(stringBuilder, "[" + text + "]", ref LastTranslatedWord_VietPhrase);
										list2.Add(new CharRange(stringBuilder.ToString().Length - text.Length - 2, text.Length + 2));
										break;
									default:
										if (hasOnlyOneMeaning(text))
										{
											appendTranslatedWord(stringBuilder, text, ref LastTranslatedWord_VietPhrase);
											list2.Add(new CharRange(stringBuilder.ToString().Length - text.Length, text.Length));
										}
										else
										{
											appendTranslatedWord(stringBuilder, "[" + text + "]", ref LastTranslatedWord_VietPhrase);
											list2.Add(new CharRange(stringBuilder.ToString().Length - text.Length - 2, text.Length + 2));
										}
										break;
									}
									if (nextCharIsChinese(chinese, num2 + num6 - 1))
									{
										stringBuilder.Append(" ");
										LastTranslatedWord_VietPhrase += " ";
									}
									flag = true;
									num2 += num6;
									break;
								}
							}
							else if (0 >= num7)
							{
								num3 = num2 + num6 - 1;
								flag2 = false;
								int i;
								for (i = 100; num2 + i < chinese.Length && isChinese(chinese[num2 + i - 1]); i++)
								{
								}
								if (num2 + i <= chinese.Length)
								{
									num7 = containsLuatNhan(chinese.Substring(num2, i), nhanByDictionary, out luatNhan, out matchedLength);
									if (num7 < 0)
									{
										num3 = num2 + i - 1;
									}
								}
							}
						}
					}
				}
			}
			if (flag)
			{
				continue;
			}
			int length = stringBuilder.ToString().Length;
			int num8 = ChineseToHanViet(chinese[num2]).Length;
			list.Add(new CharRange(num2, 1));
			if (isChinese(chinese[num2]))
			{
				appendTranslatedWord(stringBuilder, ((wrapType != 1) ? "" : "[") + ChineseToHanViet(chinese[num2]) + ((wrapType != 1) ? "" : "]"), ref LastTranslatedWord_VietPhrase);
				if (nextCharIsChinese(chinese, num2))
				{
					stringBuilder.Append(" ");
					LastTranslatedWord_VietPhrase += " ";
				}
				num8 += ((wrapType == 1) ? 2 : 0);
			}
			else if ((chinese[num2] == '"' || chinese[num2] == '\'') && !LastTranslatedWord_VietPhrase.EndsWith(" ") && !LastTranslatedWord_VietPhrase.EndsWith(".") && !LastTranslatedWord_VietPhrase.EndsWith("?") && !LastTranslatedWord_VietPhrase.EndsWith("!") && !LastTranslatedWord_VietPhrase.EndsWith("\t") && num2 < chinese.Length - 1 && chinese[num2 + 1] != ' ' && chinese[num2 + 1] != ',')
			{
				stringBuilder.Append(" ").Append(chinese[num2]);
				LastTranslatedWord_VietPhrase = LastTranslatedWord_VietPhrase + " " + chinese[num2];
			}
			else
			{
				stringBuilder.Append(chinese[num2]);
				LastTranslatedWord_VietPhrase += chinese[num2];
				num8 = 1;
			}
			list2.Add(new CharRange(length, num8));
			num2++;
		}
		chinesePhraseRanges = list.ToArray();
		vietPhraseRanges = list2.ToArray();
		LastTranslatedWord_VietPhrase = "";
		return stringBuilder.ToString();
	}

	public static string ChineseToVietPhraseForBrowser(string chinese, int wrapType, int translationAlgorithm, bool prioritizedName)
	{
		chinese = StandardizeInputForBrowser(chinese);
		StringBuilder stringBuilder = new StringBuilder();
		string[] array = classifyWordsIntoLatinAndChinese(chinese);
		string[] array2 = array;
		foreach (string text in array2)
		{
			if (!string.IsNullOrEmpty(text))
			{
				if (isChinese(text[0]))
				{
					stringBuilder.Append(ChineseToVietPhrase(text, wrapType, translationAlgorithm, prioritizedName, out var _, out var _));
				}
				else
				{
					stringBuilder.Append(text);
				}
			}
		}
		return stringBuilder.ToString();
	}

	public static string ChineseToVietPhraseForBatch(string chinese, int wrapType, int translationAlgorithm, bool prioritizedName)
	{
		string lastTranslatedWord = "";
		StringBuilder stringBuilder = new StringBuilder();
		int num = chinese.Length - 1;
		int num2 = 0;
		int num3 = -1;
		int num4 = -1;
		int num5 = -1;
		while (num2 <= num)
		{
			bool flag = false;
			bool flag2 = true;
			for (int num6 = 20; num6 > 0; num6--)
			{
				if (chinese.Length >= num2 + num6)
				{
					if (vietPhraseDictionary.ContainsKey(chinese.Substring(num2, num6)))
					{
						if ((!prioritizedName || !containsName(chinese, num2, num6)) && ((translationAlgorithm != 0 && translationAlgorithm != 2) || isLongestPhraseInSentence(chinese, num2, num6, vietPhraseDictionary, translationAlgorithm) || (prioritizedName && onlyNameDictionary.ContainsKey(chinese.Substring(num2, num6)))))
						{
							if (!string.IsNullOrEmpty(vietPhraseDictionary[chinese.Substring(num2, num6)]))
							{
								switch (wrapType)
								{
								case 0:
									appendTranslatedWord(stringBuilder, vietPhraseDictionary[chinese.Substring(num2, num6)], ref lastTranslatedWord);
									break;
								case 1:
								case 11:
									appendTranslatedWord(stringBuilder, "[" + vietPhraseDictionary[chinese.Substring(num2, num6)] + "]", ref lastTranslatedWord);
									break;
								default:
									if (hasOnlyOneMeaning(vietPhraseDictionary[chinese.Substring(num2, num6)]))
									{
										appendTranslatedWord(stringBuilder, vietPhraseDictionary[chinese.Substring(num2, num6)], ref lastTranslatedWord);
									}
									else
									{
										appendTranslatedWord(stringBuilder, "[" + vietPhraseDictionary[chinese.Substring(num2, num6)] + "]", ref lastTranslatedWord);
									}
									break;
								}
								if (nextCharIsChinese(chinese, num2 + num6 - 1))
								{
									stringBuilder.Append(" ");
									lastTranslatedWord += " ";
								}
							}
							flag = true;
							num2 += num6;
							break;
						}
					}
					else if (!chinese.Substring(num2, num6).Contains("\n") && !chinese.Substring(num2, num6).Contains("\t") && nhanByDictionary != null && flag2 && 2 < num6 && num3 < num2 + num6 - 1 && IsAllChinese(chinese.Substring(num2, num6)))
					{
						if (num2 < num4)
						{
							if (num4 < num2 + num6 && num6 <= num5 - num4)
							{
								num6 = num4 - num2 + 1;
							}
						}
						else
						{
							string luatNhan = string.Empty;
							int matchedLength = -1;
							int num7 = containsLuatNhan(chinese.Substring(num2, num6), nhanByDictionary, out luatNhan, out matchedLength);
							num4 = num2 + num7;
							num5 = num4 + matchedLength;
							if (num7 == 0)
							{
								if (isLongestPhraseInSentence(chinese, num2 - 1, matchedLength - 1, vietPhraseOneMeaningDictionary, translationAlgorithm))
								{
									num6 = matchedLength;
									string text = ChineseToLuatNhan(chinese.Substring(num2, num6), nhanByDictionary);
									switch (wrapType)
									{
									case 0:
										appendTranslatedWord(stringBuilder, text, ref lastTranslatedWord);
										break;
									case 1:
									case 11:
										appendTranslatedWord(stringBuilder, "[" + text + "]", ref lastTranslatedWord);
										break;
									default:
										if (hasOnlyOneMeaning(text))
										{
											appendTranslatedWord(stringBuilder, text, ref lastTranslatedWord);
										}
										else
										{
											appendTranslatedWord(stringBuilder, "[" + text + "]", ref lastTranslatedWord);
										}
										break;
									}
									if (nextCharIsChinese(chinese, num2 + num6 - 1))
									{
										stringBuilder.Append(" ");
										lastTranslatedWord += " ";
									}
									flag = true;
									num2 += num6;
									break;
								}
							}
							else if (0 >= num7)
							{
								num3 = num2 + num6 - 1;
								flag2 = false;
								int i;
								for (i = 100; num2 + i < chinese.Length && isChinese(chinese[num2 + i - 1]); i++)
								{
								}
								if (num2 + i <= chinese.Length)
								{
									num7 = containsLuatNhan(chinese.Substring(num2, i), nhanByDictionary, out luatNhan, out matchedLength);
									if (num7 < 0)
									{
										num3 = num2 + i - 1;
									}
								}
							}
						}
					}
				}
			}
			if (flag)
			{
				continue;
			}
			if (isChinese(chinese[num2]))
			{
				appendTranslatedWord(stringBuilder, ((wrapType != 1) ? "" : "[") + ChineseToHanViet(chinese[num2]) + ((wrapType != 1) ? "" : "]"), ref lastTranslatedWord);
				if (nextCharIsChinese(chinese, num2))
				{
					stringBuilder.Append(" ");
					lastTranslatedWord += " ";
				}
			}
			else if ((chinese[num2] == '"' || chinese[num2] == '\'') && !lastTranslatedWord.EndsWith(" ") && !lastTranslatedWord.EndsWith(".") && !lastTranslatedWord.EndsWith("?") && !lastTranslatedWord.EndsWith("!") && !lastTranslatedWord.EndsWith("\t") && num2 < chinese.Length - 1 && chinese[num2 + 1] != ' ' && chinese[num2 + 1] != ',')
			{
				stringBuilder.Append(" ").Append(chinese[num2]);
				lastTranslatedWord = lastTranslatedWord + " " + chinese[num2];
			}
			else
			{
				stringBuilder.Append(chinese[num2]);
				lastTranslatedWord += chinese[num2];
			}
			num2++;
		}
		return stringBuilder.ToString().Replace("  ", " ");
	}

	public static string ChineseToVietPhraseOneMeaning(string chinese, int wrapType, int translationAlgorithm, bool prioritizedName, out CharRange[] chinesePhraseRanges, out CharRange[] vietPhraseRanges)
	{
		LastTranslatedWord_VietPhraseOneMeaning = "";
		List<CharRange> list = new List<CharRange>();
		List<CharRange> list2 = new List<CharRange>();
		StringBuilder stringBuilder = new StringBuilder();
		int num = chinese.Length - 1;
		int num2 = 0;
		int num3 = -1;
		int num4 = -1;
		int num5 = -1;
		loadNhanByOneMeaningDictionary();
		while (num2 <= num)
		{
			bool flag = false;
			bool flag2 = true;
			for (int num6 = 20; num6 > 0; num6--)
			{
				if (chinese.Length >= num2 + num6)
				{
					if (vietPhraseOneMeaningDictionary.ContainsKey(chinese.Substring(num2, num6)))
					{
						if ((!prioritizedName || !containsName(chinese, num2, num6)) && ((translationAlgorithm != 0 && translationAlgorithm != 2) || isLongestPhraseInSentence(chinese, num2, num6, vietPhraseOneMeaningDictionary, translationAlgorithm) || (prioritizedName && onlyNameDictionary.ContainsKey(chinese.Substring(num2, num6)))))
						{
							list.Add(new CharRange(num2, num6));
							if (wrapType == 0)
							{
								appendTranslatedWord(stringBuilder, vietPhraseOneMeaningDictionary[chinese.Substring(num2, num6)], ref LastTranslatedWord_VietPhraseOneMeaning);
								list2.Add(new CharRange(stringBuilder.ToString().Length - vietPhraseOneMeaningDictionary[chinese.Substring(num2, num6)].Length, vietPhraseOneMeaningDictionary[chinese.Substring(num2, num6)].Length));
							}
							else
							{
								appendTranslatedWord(stringBuilder, "[" + vietPhraseOneMeaningDictionary[chinese.Substring(num2, num6)] + "]", ref LastTranslatedWord_VietPhraseOneMeaning);
								list2.Add(new CharRange(stringBuilder.ToString().Length - vietPhraseOneMeaningDictionary[chinese.Substring(num2, num6)].Length - 2, vietPhraseOneMeaningDictionary[chinese.Substring(num2, num6)].Length + 2));
							}
							if (nextCharIsChinese(chinese, num2 + num6 - 1))
							{
								stringBuilder.Append(" ");
								LastTranslatedWord_VietPhraseOneMeaning += " ";
							}
							flag = true;
							num2 += num6;
							break;
						}
					}
					else if (!chinese.Substring(num2, num6).Contains("\n") && !chinese.Substring(num2, num6).Contains("\t") && nhanByOneMeaningDictionary != null && flag2 && 2 < num6 && num3 < num2 + num6 - 1 && IsAllChinese(chinese.Substring(num2, num6)))
					{
						if (num2 < num4)
						{
							if (num4 < num2 + num6 && num6 <= num5 - num4)
							{
								num6 = num4 - num2 + 1;
							}
						}
						else
						{
							string luatNhan = string.Empty;
							int matchedLength = -1;
							int num7 = containsLuatNhan(chinese.Substring(num2, num6), nhanByOneMeaningDictionary, out luatNhan, out matchedLength);
							num4 = num2 + num7;
							num5 = num4 + matchedLength;
							if (num7 == 0)
							{
								if (isLongestPhraseInSentence(chinese, num2 - 1, matchedLength - 1, vietPhraseOneMeaningDictionary, translationAlgorithm))
								{
									num6 = matchedLength;
									list.Add(new CharRange(num2, num6));
									string text = ChineseToLuatNhan(chinese.Substring(num2, num6), nhanByOneMeaningDictionary);
									if (wrapType == 0)
									{
										appendTranslatedWord(stringBuilder, text, ref LastTranslatedWord_VietPhraseOneMeaning);
										list2.Add(new CharRange(stringBuilder.ToString().Length - text.Length, text.Length));
									}
									else
									{
										appendTranslatedWord(stringBuilder, "[" + text + "]", ref LastTranslatedWord_VietPhraseOneMeaning);
										list2.Add(new CharRange(stringBuilder.ToString().Length - text.Length - 2, text.Length + 2));
									}
									if (nextCharIsChinese(chinese, num2 + num6 - 1))
									{
										stringBuilder.Append(" ");
										LastTranslatedWord_VietPhraseOneMeaning += " ";
									}
									flag = true;
									num2 += num6;
									break;
								}
							}
							else if (0 >= num7)
							{
								num3 = num2 + num6 - 1;
								flag2 = false;
								int i;
								for (i = 100; num2 + i < chinese.Length && isChinese(chinese[num2 + i - 1]); i++)
								{
								}
								if (num2 + i <= chinese.Length)
								{
									num7 = containsLuatNhan(chinese.Substring(num2, i), nhanByOneMeaningDictionary, out luatNhan, out matchedLength);
									if (num7 < 0)
									{
										num3 = num2 + i - 1;
									}
								}
							}
						}
					}
				}
			}
			if (flag)
			{
				continue;
			}
			int length = stringBuilder.ToString().Length;
			int num8 = ChineseToHanViet(chinese[num2]).Length;
			list.Add(new CharRange(num2, 1));
			if (isChinese(chinese[num2]))
			{
				appendTranslatedWord(stringBuilder, ((wrapType != 1) ? "" : "[") + ChineseToHanViet(chinese[num2]) + ((wrapType != 1) ? "" : "]"), ref LastTranslatedWord_VietPhraseOneMeaning);
				if (nextCharIsChinese(chinese, num2))
				{
					stringBuilder.Append(" ");
					LastTranslatedWord_VietPhraseOneMeaning += " ";
				}
				num8 += ((wrapType == 1) ? 2 : 0);
			}
			else if ((chinese[num2] == '"' || chinese[num2] == '\'') && !LastTranslatedWord_VietPhraseOneMeaning.EndsWith(" ") && !LastTranslatedWord_VietPhraseOneMeaning.EndsWith(".") && !LastTranslatedWord_VietPhraseOneMeaning.EndsWith("?") && !LastTranslatedWord_VietPhraseOneMeaning.EndsWith("!") && !LastTranslatedWord_VietPhraseOneMeaning.EndsWith("\t") && num2 < chinese.Length - 1 && chinese[num2 + 1] != ' ' && chinese[num2 + 1] != ',')
			{
				stringBuilder.Append(" ").Append(chinese[num2]);
				LastTranslatedWord_VietPhraseOneMeaning = LastTranslatedWord_VietPhraseOneMeaning + " " + chinese[num2];
			}
			else
			{
				stringBuilder.Append(chinese[num2]);
				LastTranslatedWord_VietPhraseOneMeaning += chinese[num2];
				num8 = 1;
			}
			list2.Add(new CharRange(length, num8));
			num2++;
		}
		chinesePhraseRanges = list.ToArray();
		vietPhraseRanges = list2.ToArray();
		LastTranslatedWord_VietPhraseOneMeaning = "";
		return stringBuilder.ToString();
	}

	public static string ChineseToVietPhraseOneMeaningForBrowser(string chinese, int wrapType, int translationAlgorithm, bool prioritizedName)
	{
		chinese = StandardizeInputForBrowser(chinese);
		StringBuilder stringBuilder = new StringBuilder();
		string[] array = classifyWordsIntoLatinAndChinese(chinese);
		int num = array.Length;
		for (int i = 0; i < num; i++)
		{
			string text = array[i];
			if (string.IsNullOrEmpty(text))
			{
				continue;
			}
			string text2;
			if (isChinese(text[0]))
			{
				text2 = ChineseToVietPhraseOneMeaning(text, wrapType, translationAlgorithm, prioritizedName, out var _, out var _).TrimStart();
				if (i == 0 || !array[i - 1].EndsWith(", "))
				{
					text2 = toUpperCase(text2);
				}
			}
			else
			{
				text2 = text;
			}
			stringBuilder.Append(text2);
		}
		return stringBuilder.ToString();
	}

	public static string ChineseToVietPhraseOneMeaningForProxy(string chinese, int wrapType, int translationAlgorithm, bool prioritizedName)
	{
		chinese = StandardizeInputForProxy(chinese);
		StringBuilder stringBuilder = new StringBuilder();
		string[] array = classifyWordsIntoLatinAndChineseForProxy(chinese);
		string[] array2 = array;
		foreach (string text in array2)
		{
			if (!string.IsNullOrEmpty(text))
			{
				if (isChinese(text[0]))
				{
					stringBuilder.Append(ChineseToVietPhraseOneMeaning(text, wrapType, translationAlgorithm, prioritizedName, out var _, out var _));
				}
				else
				{
					stringBuilder.Append(text);
				}
			}
		}
		return stringBuilder.ToString();
	}

	public static string ChineseToVietPhraseOneMeaningForBatch(string chinese, int wrapType, int translationAlgorithm, bool prioritizedName)
	{
		_ = DateTime.Now;
		string lastTranslatedWord = "";
		StringBuilder stringBuilder = new StringBuilder();
		int num = chinese.Length - 1;
		int num2 = 0;
		int num3 = -1;
		int num4 = -1;
		int num5 = -1;
		while (num2 <= num)
		{
			bool flag = false;
			bool flag2 = true;
			if (chinese[num2] != '\n' && chinese[num2] != '\t')
			{
				for (int num6 = 20; num6 > 0; num6--)
				{
					if (chinese.Length >= num2 + num6)
					{
						if (vietPhraseOneMeaningDictionary.ContainsKey(chinese.Substring(num2, num6)))
						{
							if ((!prioritizedName || !containsName(chinese, num2, num6)) && ((translationAlgorithm != 0 && translationAlgorithm != 2) || isLongestPhraseInSentence(chinese, num2, num6, vietPhraseOneMeaningDictionary, translationAlgorithm) || (prioritizedName && onlyNameDictionary.ContainsKey(chinese.Substring(num2, num6)))))
							{
								if (!string.IsNullOrEmpty(vietPhraseOneMeaningDictionary[chinese.Substring(num2, num6)]))
								{
									if (wrapType == 0)
									{
										appendTranslatedWord(stringBuilder, vietPhraseOneMeaningDictionary[chinese.Substring(num2, num6)], ref lastTranslatedWord);
									}
									else
									{
										appendTranslatedWord(stringBuilder, "[" + vietPhraseOneMeaningDictionary[chinese.Substring(num2, num6)] + "]", ref lastTranslatedWord);
									}
									if (nextCharIsChinese(chinese, num2 + num6 - 1))
									{
										stringBuilder.Append(" ");
										lastTranslatedWord += " ";
									}
								}
								flag = true;
								num2 += num6;
								break;
							}
						}
						else if (!chinese.Substring(num2, num6).Contains("\n") && !chinese.Substring(num2, num6).Contains("\t") && nhanByOneMeaningDictionary != null && flag2 && 2 < num6 && num3 < num2 + num6 - 1 && IsAllChinese(chinese.Substring(num2, num6)))
						{
							if (num2 < num4)
							{
								if (num4 < num2 + num6 && num6 <= num5 - num4)
								{
									num6 = num4 - num2 + 1;
								}
							}
							else
							{
								string luatNhan = string.Empty;
								int matchedLength = -1;
								int num7 = containsLuatNhan(chinese.Substring(num2, num6), nhanByOneMeaningDictionary, out luatNhan, out matchedLength);
								num4 = num2 + num7;
								num5 = num4 + matchedLength;
								if (num7 == 0)
								{
									if (isLongestPhraseInSentence(chinese, num2 - 1, matchedLength - 1, vietPhraseOneMeaningDictionary, translationAlgorithm))
									{
										num6 = matchedLength;
										string text = ChineseToLuatNhan(chinese.Substring(num2, num6), nhanByOneMeaningDictionary);
										if (wrapType == 0)
										{
											appendTranslatedWord(stringBuilder, text, ref lastTranslatedWord);
										}
										else
										{
											appendTranslatedWord(stringBuilder, "[" + text + "]", ref lastTranslatedWord);
										}
										if (nextCharIsChinese(chinese, num2 + num6 - 1))
										{
											stringBuilder.Append(" ");
											lastTranslatedWord += " ";
										}
										flag = true;
										num2 += num6;
										break;
									}
								}
								else if (0 >= num7)
								{
									num3 = num2 + num6 - 1;
									flag2 = false;
									int i;
									for (i = 100; num2 + i < chinese.Length && isChinese(chinese[num2 + i - 1]); i++)
									{
									}
									if (num2 + i <= chinese.Length)
									{
										num7 = containsLuatNhan(chinese.Substring(num2, i), nhanByOneMeaningDictionary, out luatNhan, out matchedLength);
										if (num7 < 0)
										{
											num3 = num2 + i - 1;
										}
									}
								}
							}
						}
					}
				}
			}
			if (flag)
			{
				continue;
			}
			if (isChinese(chinese[num2]))
			{
				appendTranslatedWord(stringBuilder, ((wrapType != 1) ? "" : "[") + ChineseToHanViet(chinese[num2]) + ((wrapType != 1) ? "" : "]"), ref lastTranslatedWord);
				if (nextCharIsChinese(chinese, num2))
				{
					stringBuilder.Append(" ");
					lastTranslatedWord += " ";
				}
			}
			else if ((chinese[num2] == '"' || chinese[num2] == '\'') && !lastTranslatedWord.EndsWith(" ") && !lastTranslatedWord.EndsWith(".") && !lastTranslatedWord.EndsWith("?") && !lastTranslatedWord.EndsWith("!") && !lastTranslatedWord.EndsWith("\t") && num2 < chinese.Length - 1 && chinese[num2 + 1] != ' ' && chinese[num2 + 1] != ',')
			{
				stringBuilder.Append(" ").Append(chinese[num2]);
				lastTranslatedWord = lastTranslatedWord + " " + chinese[num2];
			}
			else
			{
				stringBuilder.Append(chinese[num2]);
				lastTranslatedWord += chinese[num2];
			}
			num2++;
		}
		return stringBuilder.ToString();
	}

	public static string ChineseToNameForBatch(string chinese)
	{
		StringBuilder stringBuilder = new StringBuilder();
		int num = chinese.Length - 1;
		int num2 = 0;
		while (num2 <= num)
		{
			bool flag = false;
			if (isChinese(chinese[num2]))
			{
				for (int num3 = 20; num3 > 0; num3--)
				{
					if (chinese.Length >= num2 + num3 && onlyNameDictionary.ContainsKey(chinese.Substring(num2, num3)))
					{
						stringBuilder.Append(onlyNameDictionary[chinese.Substring(num2, num3)]);
						flag = true;
						num2 += num3;
						break;
					}
				}
			}
			if (!flag)
			{
				stringBuilder.Append(chinese[num2]);
				num2++;
			}
		}
		return stringBuilder.ToString();
	}

	public static string ChineseToMeanings(string chinese, out int phraseTranslatedLength)
	{
		string text = "";
		if (chinese.Length == 0)
		{
			phraseTranslatedLength = 0;
			return "";
		}
		int num = 0;
		for (int num2 = 20; num2 > 0; num2--)
		{
			if (chinese.Length >= num2 && !chinese.Substring(0, num2).Contains("\n") && !chinese.Substring(0, num2).Contains("\t"))
			{
				if (containsLuatNhan(chinese.Substring(0, num2), vietPhraseDictionary) != 0)
				{
					break;
				}
				if (matchesLuatNhan(chinese.Substring(0, num2), vietPhraseDictionary))
				{
					string luatNhan = string.Empty;
					ChineseToLuatNhan(chinese.Substring(0, num2), vietPhraseDictionary, out luatNhan);
					string text2 = text;
					text = text2 + luatNhan + " <<Luật Nhân>> " + luatNhanDictionary[luatNhan].Replace("/", "; ") + "\n-----------------\n";
					if (num == 0)
					{
						num = num2;
					}
				}
			}
		}
		for (int num3 = 20; num3 > 0; num3--)
		{
			if (chinese.Length >= num3)
			{
				string text3 = chinese.Substring(0, num3);
				if (vietPhraseDictionary.ContainsKey(text3))
				{
					string text4 = text;
					text = text4 + text3 + " <<VietPhrase>> " + vietPhraseDictionary[text3].Replace("/", "; ") + "\n-----------------\n";
					if (num == 0)
					{
						num = text3.Length;
					}
				}
			}
		}
		for (int num4 = 20; num4 > 0; num4--)
		{
			if (chinese.Length >= num4)
			{
				string text3 = chinese.Substring(0, num4);
				if (lacVietDictionary.ContainsKey(text3))
				{
					string text5 = text;
					text = text5 + text3 + " <<Lạc Việt>>\n" + lacVietDictionary[text3] + "\n-----------------\n";
					if (num == 0)
					{
						num = 1;
					}
				}
			}
		}
		for (int num5 = 20; num5 > 0; num5--)
		{
			if (chinese.Length >= num5)
			{
				string text3 = chinese.Substring(0, num5);
				if (cedictDictionary.ContainsKey(text3))
				{
					string text6 = text;
					text = text6 + text3 + " <<Cedict or Babylon>> " + cedictDictionary[text3].Replace("] /", "] ").Replace("/", "; ") + "\n-----------------\n";
					if (num == 0)
					{
						num = 1;
					}
				}
			}
		}
		if (thieuChuuDictionary.ContainsKey(chinese[0].ToString()))
		{
			num = ((num == 0) ? 1 : num);
			object obj = text;
			text = string.Concat(obj, chinese[0], " <<Thiều Chửu>> ", thieuChuuDictionary[chinese[0].ToString()], "\n-----------------\n");
		}
		int num6 = ((chinese.Length < 10) ? chinese.Length : 10);
		text = text + chinese.Substring(0, num6).Trim("\n\t ".ToCharArray()) + " <<Phiên Âm English>> ";
		for (int i = 0; i < num6; i++)
		{
			text = ((!chinesePhienAmEnglishDictionary.ContainsKey(chinese[i].ToString())) ? (text + ChineseToHanViet(chinese[i]) + " ") : (text + "[" + chinesePhienAmEnglishDictionary[chinese[i].ToString()] + "] "));
		}
		if (num == 0)
		{
			num = 1;
			text = chinese[0] + "\n-----------------\nNot Found";
		}
		phraseTranslatedLength = num;
		return text;
	}

	public static void LoadDictionaries()
	{
		lock (lockObject)
		{
			if (dictionaryDirty)
			{
				ThreadPool.QueueUserWorkItem(loadHanVietDictionaryWithNewThread);
				ThreadPool.QueueUserWorkItem(loadThieuChuuDictionaryWithNewThread);
				ThreadPool.QueueUserWorkItem(loadLacVietDictionaryWithNewThread);
				ThreadPool.QueueUserWorkItem(loadCedictDictionaryWithNewThread);
				ThreadPool.QueueUserWorkItem(loadChinesePhienAmEnglishDictionaryWithNewThread);
				ThreadPool.QueueUserWorkItem(loadIgnoredChinesePhraseListsWithNewThread);
				ThreadPool.QueueUserWorkItem(loadOnlyNameDictionaryHistoryWithNewThread);
				ThreadPool.QueueUserWorkItem(loadOnlyNamePhuDictionaryHistoryWithNewThread);
				ThreadPool.QueueUserWorkItem(loadOnlyVietPhraseDictionaryHistoryWithNewThread);
				ThreadPool.QueueUserWorkItem(loadHanVietDictionaryHistoryWithNewThread);
				ManualResetEvent[] array = new ManualResetEvent[1]
				{
					new ManualResetEvent(initialState: false)
				};
				ThreadPool.QueueUserWorkItem(loadLuatNhanDictionaryWithNewThread, array[0]);
				ManualResetEvent[] array2 = new ManualResetEvent[1]
				{
					new ManualResetEvent(initialState: false)
				};
				ThreadPool.QueueUserWorkItem(loadPronounDictionaryWithNewThread, array2[0]);
				ManualResetEvent[] array3 = new ManualResetEvent[1]
				{
					new ManualResetEvent(initialState: false)
				};
				ThreadPool.QueueUserWorkItem(loadOnlyVietPhraseDictionaryWithNewThread, array3[0]);
				ManualResetEvent[] array4 = new ManualResetEvent[1]
				{
					new ManualResetEvent(initialState: false)
				};
				ThreadPool.QueueUserWorkItem(loadOnlyNameDictionaryWithNewThread, array4[0]);
				WaitHandle.WaitAll(array2);
				WaitHandle.WaitAll(array3);
				WaitHandle.WaitAll(array4);
				loadVietPhraseDictionary();
				vietPhraseDictionaryToVietPhraseOneMeaningDictionary();
				pronounDictionaryToPronounOneMeaningDictionary();
				loadNhanByDictionary();
				loadNhanByOneMeaningDictionary();
				WaitHandle.WaitAll(array);
				dictionaryDirty = false;
			}
		}
	}

	private static void loadLuatNhanDictionaryWithNewThread(object stateInfo)
	{
		loadLuatNhanDictionary();
		((ManualResetEvent)stateInfo).Set();
	}

	private static void loadLuatNhanDictionary()
	{
		Dictionary<string, string> dictionary = new Dictionary<string, string>();
		using (TextReader textReader = new StreamReader(DictionaryConfigurationHelper.GetLuatNhanDictionaryPath(), detectEncodingFromByteOrderMarks: true))
		{
			string text;
			while ((text = textReader.ReadLine()) != null)
			{
				if (!text.StartsWith("#"))
				{
					string[] array = text.Split('=');
					if (array.Length == 2 && !dictionary.ContainsKey(array[0]))
					{
						dictionary.Add(array[0], array[1]);
					}
				}
			}
		}
		IOrderedEnumerable<KeyValuePair<string, string>> orderedEnumerable = from pair in dictionary
			orderby pair.Key.Length descending, pair.Key
			select pair;
		luatNhanDictionary.Clear();
		foreach (KeyValuePair<string, string> item in orderedEnumerable)
		{
			luatNhanDictionary.Add(item.Key, item.Value);
		}
	}

	private static int compareLuatNhan(KeyValuePair<string, string> x, KeyValuePair<string, string> y)
	{
		if (x.Key.StartsWith("{0}") || x.Key.EndsWith("{0}"))
		{
			if (!y.Key.StartsWith("{0}") && !y.Key.EndsWith("{0}"))
			{
				return 1;
			}
		}
		else if (y.Key.StartsWith("{0}") || y.Key.EndsWith("{0}"))
		{
			return -1;
		}
		return y.Key.Length - x.Key.Length;
	}

	private static void loadHanVietDictionaryWithNewThread(object stateInfo)
	{
		loadHanVietDictionary();
	}

	private static void loadHanVietDictionary()
	{
		hanVietDictionary.Clear();
		using TextReader textReader = new StreamReader(DictionaryConfigurationHelper.GetChinesePhienAmWordsDictionaryPath(), detectEncodingFromByteOrderMarks: true);
		string text;
		while ((text = textReader.ReadLine()) != null)
		{
			string[] array = text.Split('=');
			if (array.Length == 2 && !hanVietDictionary.ContainsKey(array[0]))
			{
				hanVietDictionary.Add(array[0], array[1]);
			}
		}
	}

	private static void loadVietPhraseDictionary()
	{
		vietPhraseDictionary.Clear();
		foreach (KeyValuePair<string, string> item in onlyNameDictionary)
		{
			if (!vietPhraseDictionary.ContainsKey(item.Key))
			{
				vietPhraseDictionary.Add(item.Key, item.Value);
			}
		}
		foreach (KeyValuePair<string, string> item2 in onlyVietPhraseDictionary)
		{
			if (!vietPhraseDictionary.ContainsKey(item2.Key))
			{
				vietPhraseDictionary.Add(item2.Key, item2.Value);
			}
		}
	}

	private static void loadOnlyVietPhraseDictionaryWithNewThread(object stateInfo)
	{
		loadOnlyVietPhraseDictionary();
		((ManualResetEvent)stateInfo).Set();
	}

	private static void loadOnlyVietPhraseDictionary()
	{
		onlyVietPhraseDictionary.Clear();
		using TextReader textReader = new StreamReader(DictionaryConfigurationHelper.GetVietPhraseDictionaryPath(), detectEncodingFromByteOrderMarks: true);
		string text;
		while ((text = textReader.ReadLine()) != null)
		{
			string[] array = text.Split('=');
			if (array.Length == 2 && !onlyVietPhraseDictionary.ContainsKey(array[0]))
			{
				onlyVietPhraseDictionary.Add(array[0], array[1]);
			}
		}
	}

	private static void loadOnlyNameDictionaryWithNewThread(object stateInfo)
	{
		loadOnlyNameDictionary();
		((ManualResetEvent)stateInfo).Set();
	}

	private static void loadOnlyNameDictionary()
	{
		onlyNameDictionary.Clear();
		onlyNameOneMeaningDictionary.Clear();
		onlyNameChinhDictionary.Clear();
		onlyNamePhuDictionary.Clear();
		char[] separator = "/|".ToCharArray();
		using (TextReader textReader = new StreamReader(DictionaryConfigurationHelper.GetNamesDictionaryPath(), detectEncodingFromByteOrderMarks: true))
		{
			string text;
			while ((text = textReader.ReadLine()) != null)
			{
				string[] array = text.Split('=');
				if (array.Length == 2 && !onlyNameDictionary.ContainsKey(array[0]))
				{
					onlyNameDictionary.Add(array[0], array[1]);
					onlyNameOneMeaningDictionary.Add(array[0], array[1].Split(separator)[0]);
					onlyNameChinhDictionary.Add(array[0], array[1]);
				}
			}
		}
		using TextReader textReader2 = new StreamReader(DictionaryConfigurationHelper.GetNamesPhuDictionaryPath(), detectEncodingFromByteOrderMarks: true);
		string text2;
		while ((text2 = textReader2.ReadLine()) != null)
		{
			string[] array2 = text2.Split('=');
			if (array2.Length == 2 && !onlyNamePhuDictionary.ContainsKey(array2[0]))
			{
				if (onlyNameDictionary.ContainsKey(array2[0]))
				{
					onlyNameDictionary[array2[0]] = array2[1];
					onlyNameOneMeaningDictionary[array2[0]] = array2[1].Split(separator)[0];
				}
				else
				{
					onlyNameDictionary.Add(array2[0], array2[1]);
					onlyNameOneMeaningDictionary.Add(array2[0], array2[1].Split(separator)[0]);
				}
				onlyNamePhuDictionary.Add(array2[0], array2[1]);
			}
		}
	}

	private static void vietPhraseDictionaryToVietPhraseOneMeaningDictionary()
	{
		vietPhraseOneMeaningDictionary.Clear();
		foreach (KeyValuePair<string, string> item in vietPhraseDictionary)
		{
			vietPhraseOneMeaningDictionary.Add(item.Key, (item.Value.Contains("/") || item.Value.Contains("|")) ? item.Value.Split('/', '|')[0] : item.Value);
		}
	}

	private static void pronounDictionaryToPronounOneMeaningDictionary()
	{
		pronounOneMeaningDictionary.Clear();
		foreach (KeyValuePair<string, string> item in pronounDictionary)
		{
			pronounOneMeaningDictionary.Add(item.Key, (item.Value.Contains("/") || item.Value.Contains("|")) ? item.Value.Split('/', '|')[0] : item.Value);
		}
	}

	private static void loadNhanByDictionary()
	{
		if (DictionaryConfigurationHelper.IsNhanByPronouns)
		{
			nhanByDictionary = pronounDictionary;
			return;
		}
		if (DictionaryConfigurationHelper.IsNhanByPronounsAndNames)
		{
			nhanByDictionary = new Dictionary<string, string>(pronounDictionary);
			{
				foreach (KeyValuePair<string, string> item in onlyNameDictionary)
				{
					if (!nhanByDictionary.ContainsKey(item.Key))
					{
						nhanByDictionary.Add(item.Key, item.Value);
					}
				}
				return;
			}
		}
		if (DictionaryConfigurationHelper.IsNhanByPronounsAndNamesAndVietPhrase)
		{
			nhanByDictionary = new Dictionary<string, string>(pronounDictionary);
			{
				foreach (KeyValuePair<string, string> item2 in vietPhraseDictionary)
				{
					if (!nhanByDictionary.ContainsKey(item2.Key))
					{
						nhanByDictionary.Add(item2.Key, item2.Value);
					}
				}
				return;
			}
		}
		nhanByDictionary = null;
	}

	private static void loadNhanByOneMeaningDictionary()
	{
		if (DictionaryConfigurationHelper.IsNhanByPronouns)
		{
			nhanByOneMeaningDictionary = pronounOneMeaningDictionary;
			return;
		}
		if (DictionaryConfigurationHelper.IsNhanByPronounsAndNames)
		{
			nhanByOneMeaningDictionary = new Dictionary<string, string>(pronounOneMeaningDictionary);
			{
				foreach (KeyValuePair<string, string> item in onlyNameOneMeaningDictionary)
				{
					if (!nhanByOneMeaningDictionary.ContainsKey(item.Key))
					{
						nhanByOneMeaningDictionary.Add(item.Key, item.Value);
					}
				}
				return;
			}
		}
		if (DictionaryConfigurationHelper.IsNhanByPronounsAndNamesAndVietPhrase)
		{
			nhanByOneMeaningDictionary = new Dictionary<string, string>(pronounOneMeaningDictionary);
			{
				foreach (KeyValuePair<string, string> item2 in vietPhraseOneMeaningDictionary)
				{
					if (!nhanByOneMeaningDictionary.ContainsKey(item2.Key))
					{
						nhanByOneMeaningDictionary.Add(item2.Key, item2.Value);
					}
				}
				return;
			}
		}
		nhanByOneMeaningDictionary = null;
	}

	private static void loadThieuChuuDictionaryWithNewThread(object stateInfo)
	{
		loadThieuChuuDictionary();
	}

	private static void loadThieuChuuDictionary()
	{
		thieuChuuDictionary.Clear();
		using TextReader textReader = new StreamReader(DictionaryConfigurationHelper.GetThieuChuuDictionaryPath(), detectEncodingFromByteOrderMarks: true);
		string text;
		while ((text = textReader.ReadLine()) != null)
		{
			string[] array = text.Split('=');
			if (array.Length == 2 && !thieuChuuDictionary.ContainsKey(array[0]))
			{
				thieuChuuDictionary.Add(array[0], array[1]);
			}
		}
	}

	private static void loadLacVietDictionaryWithNewThread(object stateInfo)
	{
		loadLacVietDictionary();
	}

	private static void loadLacVietDictionary()
	{
		lacVietDictionary.Clear();
		using TextReader textReader = new StreamReader(DictionaryConfigurationHelper.GetLacVietDictionaryPath(), detectEncodingFromByteOrderMarks: true);
		string text;
		while ((text = textReader.ReadLine()) != null)
		{
			string[] array = text.Split('=');
			if (array.Length == 2 && !lacVietDictionary.ContainsKey(array[0]))
			{
				lacVietDictionary.Add(array[0], array[1]);
			}
		}
	}

	private static void loadCedictDictionaryWithNewThread(object stateInfo)
	{
		loadCedictDictionary();
	}

	private static void loadChinesePhienAmEnglishDictionaryWithNewThread(object stateInfo)
	{
		loadChinesePhienAmEnglishDictionary();
	}

	private static void loadPronounDictionaryWithNewThread(object stateInfo)
	{
		loadPronounDictionary();
		((ManualResetEvent)stateInfo).Set();
	}

	private static void loadIgnoredChinesePhraseListsWithNewThread(object stateInfo)
	{
		loadIgnoredChinesePhraseLists();
	}

	private static void loadOnlyVietPhraseDictionaryHistoryWithNewThread(object stateInfo)
	{
		loadOnlyVietPhraseDictionaryHistory();
	}

	private static void loadOnlyNameDictionaryHistoryWithNewThread(object stateInfo)
	{
		loadOnlyNameDictionaryHistory();
	}

	private static void loadOnlyNamePhuDictionaryHistoryWithNewThread(object stateInfo)
	{
		loadOnlyNamePhuDictionaryHistory();
	}

	private static void loadHanVietDictionaryHistoryWithNewThread(object stateInfo)
	{
		loadHanVietDictionaryHistory();
	}

	private static void loadOnlyVietPhraseDictionaryHistory()
	{
		LoadDictionaryHistory(DictionaryConfigurationHelper.GetVietPhraseDictionaryHistoryPath(), ref onlyVietPhraseDictionaryHistoryDataSet);
	}

	private static void loadOnlyNameDictionaryHistory()
	{
		LoadDictionaryHistory(DictionaryConfigurationHelper.GetNamesDictionaryHistoryPath(), ref onlyNameDictionaryHistoryDataSet);
	}

	private static void loadOnlyNamePhuDictionaryHistory()
	{
		LoadDictionaryHistory(DictionaryConfigurationHelper.GetNamesPhuDictionaryHistoryPath(), ref onlyNamePhuDictionaryHistoryDataSet);
	}

	private static void loadHanVietDictionaryHistory()
	{
		LoadDictionaryHistory(DictionaryConfigurationHelper.GetChinesePhienAmWordsDictionaryHistoryPath(), ref hanVietDictionaryHistoryDataSet);
	}

	public static void LoadDictionaryHistory(string dictionaryHistoryPath, ref DataSet dictionaryHistoryDataSet)
	{
		dictionaryHistoryDataSet.Clear();
		string name = "DictionaryHistory";
		if (!dictionaryHistoryDataSet.Tables.Contains(name))
		{
			dictionaryHistoryDataSet.Tables.Add(name);
			dictionaryHistoryDataSet.Tables[name].Columns.Add("Entry", Type.GetType("System.String"));
			dictionaryHistoryDataSet.Tables[name].Columns.Add("Action", Type.GetType("System.String"));
			dictionaryHistoryDataSet.Tables[name].Columns.Add("User Name", Type.GetType("System.String"));
			dictionaryHistoryDataSet.Tables[name].Columns.Add("Updated Date", Type.GetType("System.DateTime"));
			dictionaryHistoryDataSet.Tables[name].PrimaryKey = new DataColumn[1] { dictionaryHistoryDataSet.Tables[name].Columns["Entry"] };
		}
		if (!File.Exists(dictionaryHistoryPath))
		{
			return;
		}
		string name2 = CharsetDetector.DetectChineseCharset(dictionaryHistoryPath);
		using TextReader textReader = new StreamReader(dictionaryHistoryPath, Encoding.GetEncoding(name2));
		textReader.ReadLine();
		string text;
		while ((text = textReader.ReadLine()) != null)
		{
			string[] array = text.Split('\t');
			if (array.Length == 4)
			{
				DataRow dataRow = dictionaryHistoryDataSet.Tables[name].Rows.Find(array[0]);
				if (dataRow == null)
				{
					dictionaryHistoryDataSet.Tables[name].Rows.Add(array[0], array[1], array[2], DateTime.ParseExact(array[3], "yyyy-MM-dd HH:mm:ss.fffzzz", null));
				}
				else
				{
					dataRow[1] = array[1];
					dataRow[2] = array[2];
					dataRow[3] = DateTime.ParseExact(array[3], "yyyy-MM-dd HH:mm:ss.fffzzz", null);
				}
			}
		}
	}

	private static void loadCedictDictionary()
	{
		cedictDictionary.Clear();
		using (TextReader textReader = new StreamReader(DictionaryConfigurationHelper.GetCEDictDictionaryPath(), Encoding.UTF8))
		{
			string text;
			while ((text = textReader.ReadLine()) != null)
			{
				if (text.StartsWith("#"))
				{
					continue;
				}
				string text2 = text.Substring(0, text.IndexOf(" ["));
				string[] array = text2.Split(' ');
				foreach (string key in array)
				{
					if (!cedictDictionary.ContainsKey(key))
					{
						cedictDictionary.Add(key, text.Substring(text.IndexOf(" [")));
					}
				}
			}
		}
		using TextReader textReader2 = new StreamReader(DictionaryConfigurationHelper.GetBabylonDictionaryPath(), Encoding.UTF8);
		string text3;
		while ((text3 = textReader2.ReadLine()) != null)
		{
			string[] array2 = text3.Split('=');
			if (!cedictDictionary.ContainsKey(array2[0]))
			{
				cedictDictionary.Add(array2[0], array2[1]);
			}
		}
	}

	private static void loadChinesePhienAmEnglishDictionary()
	{
		chinesePhienAmEnglishDictionary.Clear();
		using TextReader textReader = new StreamReader(DictionaryConfigurationHelper.GetChinesePhienAmEnglishWordsDictionaryPath(), detectEncodingFromByteOrderMarks: true);
		string text;
		while ((text = textReader.ReadLine()) != null)
		{
			string[] array = text.Split('=');
			if (array.Length == 2 && !chinesePhienAmEnglishDictionary.ContainsKey(array[0]))
			{
				chinesePhienAmEnglishDictionary.Add(array[0], array[1]);
			}
		}
	}

	private static void loadPronounDictionary()
	{
		pronounDictionary.Clear();
		using TextReader textReader = new StreamReader(DictionaryConfigurationHelper.GetPronounsDictionaryPath(), detectEncodingFromByteOrderMarks: true);
		string text;
		while ((text = textReader.ReadLine()) != null)
		{
			string[] array = text.Split('=');
			if (array.Length == 2 && !pronounDictionary.ContainsKey(array[0]))
			{
				pronounDictionary.Add(array[0], array[1]);
			}
		}
	}

	public static void AddIgnoredChinesePhrase(string ignoredChinesePhrase)
	{
		if (!ignoredChinesePhraseList.Contains(ignoredChinesePhrase))
		{
			ignoredChinesePhraseList.Add(ignoredChinesePhrase);
			try
			{
				File.WriteAllLines(DictionaryConfigurationHelper.GetIgnoredChinesePhraseListPath(), ignoredChinesePhraseList.ToArray(), Encoding.UTF8);
			}
			catch
			{
			}
			loadIgnoredChinesePhraseLists();
		}
	}

	private static void loadIgnoredChinesePhraseLists()
	{
		ignoredChinesePhraseList.Clear();
		ignoredChinesePhraseForBrowserList.Clear();
		char[] trimChars = "\t\n".ToCharArray();
		using (TextReader textReader = new StreamReader(DictionaryConfigurationHelper.GetIgnoredChinesePhraseListPath(), detectEncodingFromByteOrderMarks: true))
		{
			string text;
			while ((text = textReader.ReadLine()) != null)
			{
				if (!string.IsNullOrEmpty(text))
				{
					string text2 = standardizeInputWithoutRemovingIgnoredChinesePhrases(text).Trim(trimChars);
					if (!string.IsNullOrEmpty(text2) && !ignoredChinesePhraseList.Contains(text2))
					{
						ignoredChinesePhraseList.Add(text2);
					}
					string text3 = standardizeInputForBrowserWithoutRemovingIgnoredChinesePhrases(text).Trim(trimChars);
					if (!string.IsNullOrEmpty(text3) && !ignoredChinesePhraseForBrowserList.Contains(text3))
					{
						ignoredChinesePhraseForBrowserList.Add(text3);
					}
				}
			}
		}
		ignoredChinesePhraseList.Sort(compareStringByDescending);
		ignoredChinesePhraseForBrowserList.Sort(compareStringByDescending);
	}

	private static int compareStringByDescending(string x, string y)
	{
		if (x == null)
		{
			if (y == null)
			{
				return 0;
			}
			return 1;
		}
		if (y == null)
		{
			return -1;
		}
		int num = x.Length.CompareTo(y.Length);
		if (num != 0)
		{
			return num * -1;
		}
		return x.CompareTo(y) * -1;
	}

	public static string StandardizeInput(string original)
	{
		string standardizedChinese = standardizeInputWithoutRemovingIgnoredChinesePhrases(original);
		return removeIgnoredChinesePhrases(standardizedChinese);
	}

	private static string standardizeInputWithoutRemovingIgnoredChinesePhrases(string original)
	{
		if (string.IsNullOrEmpty(original) || string.IsNullOrEmpty(original))
		{
			return "";
		}
		string str = original;
		str = ToSimplified(str);
		string[] array = new string[16]
		{
			"，", "。", "：", "“", "”", "‘", "’", "？", "！", "「",
			"」", "．", "、", "\u3000", "…", NULL_STRING
		};
		string[] array2 = new string[16]
		{
			", ", ".", ": ", "\"", "\" ", "'", "' ", "?", "!", "\"",
			"\" ", ".", ", ", " ", "...", ""
		};
		for (int i = 0; i < array.Length; i++)
		{
			str = str.Replace(array[i], array2[i]);
		}
		str = str.Replace("  ", " ").Replace(" \r\n", "\n").Replace(" \n", "\n")
			.Replace(" ,", ",");
		str = ToNarrow(str);
		int length = str.Length;
		StringBuilder stringBuilder = new StringBuilder();
		for (int j = 0; j < length - 1; j++)
		{
			char c = str[j];
			char c2 = str[j + 1];
			if (char.IsControl(c) && c != '\t' && c != '\n' && c != '\r')
			{
				continue;
			}
			if (isChinese(c))
			{
				if (!isChinese(c2) && c2 != ',' && c2 != '.' && c2 != ':' && c2 != ';' && c2 != '"' && c2 != '\'' && c2 != '?' && c2 != ' ' && c2 != '!' && c2 != ')')
				{
					stringBuilder.Append(c).Append(" ");
				}
				else
				{
					stringBuilder.Append(c);
				}
				continue;
			}
			switch (c)
			{
			case '\t':
			case '\n':
			case ' ':
			case '"':
			case '\'':
			case '(':
				stringBuilder.Append(c);
				break;
			case '!':
			case '.':
			case '?':
				if (c2 == '"' || c2 == ' ' || c2 == '\'')
				{
					stringBuilder.Append(c);
				}
				else
				{
					stringBuilder.Append(c).Append(" ");
				}
				break;
			default:
				if (isChinese(c2))
				{
					stringBuilder.Append(c).Append(" ");
				}
				else
				{
					stringBuilder.Append(c);
				}
				break;
			}
		}
		stringBuilder.Append(str[length - 1]);
		str = indentAllLines(stringBuilder.ToString(), insertBlankLine: true);
		return str.Replace(". . . . . .", "...");
	}

	public static string StandardizeInputForBrowser(string original)
	{
		string standardizedChinese = standardizeInputForBrowserWithoutRemovingIgnoredChinesePhrases(original);
		return removeIgnoredChinesePhrasesForBrowser(standardizedChinese);
	}

	private static string standardizeInputForBrowserWithoutRemovingIgnoredChinesePhrases(string original)
	{
		if (string.IsNullOrEmpty(original) || string.IsNullOrEmpty(original))
		{
			return "";
		}
		string str = original;
		str = ToSimplified(str);
		string[] array = new string[16]
		{
			"，", "。", "：", "“", "”", "‘", "’", "？", "！", "「",
			"」", "．", "、", "\u3000", "…", NULL_STRING
		};
		string[] array2 = new string[16]
		{
			", ", ".", ": ", "\"", "\" ", "'", "' ", "?", "!", "\"",
			"\" ", ".", ", ", " ", "...", ""
		};
		for (int i = 0; i < array.Length; i++)
		{
			str = str.Replace(array[i], array2[i]);
		}
		str = str.Replace("  ", " ").Replace(" \r\n", "\n").Replace(" \n", "\n");
		str = ToNarrow(str);
		int length = str.Length;
		StringBuilder stringBuilder = new StringBuilder();
		for (int j = 0; j < length - 1; j++)
		{
			char c = str[j];
			char c2 = str[j + 1];
			if (isChinese(c))
			{
				if (!isChinese(c2) && c2 != ',' && c2 != '.' && c2 != ':' && c2 != ';' && c2 != '"' && c2 != '\'' && c2 != '?' && c2 != ' ' && c2 != '!')
				{
					stringBuilder.Append(c).Append(" ");
				}
				else
				{
					stringBuilder.Append(c);
				}
			}
			else if (c == '\t' || c == ' ' || c == '"' || c == '\'' || c == '\n')
			{
				stringBuilder.Append(c);
			}
			else if (isChinese(c2))
			{
				stringBuilder.Append(c).Append(" ");
			}
			else
			{
				stringBuilder.Append(c);
			}
		}
		stringBuilder.Append(str[length - 1]);
		return indentAllLines(stringBuilder.ToString());
	}

	public static string StandardizeInputForProxy(string original)
	{
		string standardizedChinese = standardizeInputForProxyWithoutRemovingIgnoredChinesePhrases(original);
		return removeIgnoredChinesePhrasesForBrowser(standardizedChinese);
	}

	private static string standardizeInputForProxyWithoutRemovingIgnoredChinesePhrases(string original)
	{
		if (string.IsNullOrEmpty(original) || string.IsNullOrEmpty(original))
		{
			return "";
		}
		string str = original;
		str = ToSimplified(str);
		string[] array = new string[16]
		{
			"，", "。", "：", "“", "”", "‘", "’", "？", "！", "「",
			"」", "．", "、", "\u3000", "…", NULL_STRING
		};
		string[] array2 = new string[16]
		{
			", ", ".", ": ", "\"", "\" ", "'", "' ", "?", "!", "\"",
			"\" ", ".", ", ", " ", "...", ""
		};
		for (int i = 0; i < array.Length; i++)
		{
			str = str.Replace(array[i], array2[i]);
		}
		str = str.Replace("  ", " ").Replace(" \r\n", "\n").Replace(" \n", "\n");
		str = ToNarrow(str);
		int length = str.Length;
		StringBuilder stringBuilder = new StringBuilder();
		for (int j = 0; j < length - 1; j++)
		{
			char c = str[j];
			char c2 = str[j + 1];
			if (isChinese(c))
			{
				if (!isChinese(c2) && c2 != ',' && c2 != '.' && c2 != ':' && c2 != ';' && c2 != '"' && c2 != '\'' && c2 != '?' && c2 != ' ' && c2 != '!')
				{
					stringBuilder.Append(c).Append(" ");
				}
				else
				{
					stringBuilder.Append(c);
				}
			}
			else if (c == '\t' || c == ' ' || c == '"' || c == '\'' || c == '\n')
			{
				stringBuilder.Append(c);
			}
			else if (isChinese(c2))
			{
				stringBuilder.Append(c).Append(" ");
			}
			else
			{
				stringBuilder.Append(c);
			}
		}
		stringBuilder.Append(str[length - 1]);
		return str;
	}

	private static string indentAllLines(string text, bool insertBlankLine)
	{
		string[] array = text.Split(new char[1] { '\n' }, StringSplitOptions.RemoveEmptyEntries);
		StringBuilder stringBuilder = new StringBuilder();
		string[] array2 = array;
		foreach (string text2 in array2)
		{
			if (!string.IsNullOrEmpty(text2.Trim()))
			{
				stringBuilder.Append("\t" + text2.Trim()).Append("\n").Append(insertBlankLine ? "\n" : "");
			}
		}
		return stringBuilder.ToString();
	}

	private static string indentAllLines(string text)
	{
		return indentAllLines(text, insertBlankLine: false);
	}

	private static bool isChinese(char character)
	{
		return hanVietDictionary.ContainsKey(character.ToString());
	}

	public static bool IsChinese(char character)
	{
		return isChinese(character);
	}

	public static bool IsAllChinese(string text)
	{
		foreach (char character in text)
		{
			if (!isChinese(character))
			{
				return false;
			}
		}
		return true;
	}

	private static bool hasOnlyOneMeaning(string meaning)
	{
		return meaning.Split('/', '|').Length == 1;
	}

	internal static string ToSimplified(string str)
	{
		return Strings.StrConv(str, VbStrConv.SimplifiedChinese);
	}

	internal static string ToWide(string str)
	{
		int length = str.Length;
		int i;
		for (i = 0; i < length; i++)
		{
			char c = str[i];
			if (c >= '!' && c <= '~')
			{
				break;
			}
		}
		if (i >= length)
		{
			return str;
		}
		StringBuilder stringBuilder = new StringBuilder();
		for (i = 0; i < length; i++)
		{
			char c = str[i];
			if (c >= '!' && c <= '~')
			{
				stringBuilder.Append((char)(c - 33 + 65281));
			}
			else
			{
				stringBuilder.Append(c);
			}
		}
		return stringBuilder.ToString();
	}

	internal static string ToNarrow(string str)
	{
		int length = str.Length;
		int i;
		for (i = 0; i < length; i++)
		{
			char c = str[i];
			if (c >= '！' && c <= '～')
			{
				break;
			}
		}
		if (i >= length)
		{
			return str;
		}
		StringBuilder stringBuilder = new StringBuilder();
		for (i = 0; i < length; i++)
		{
			char c = str[i];
			if (c >= '！' && c <= '～')
			{
				stringBuilder.Append((char)(c - 65281 + 33));
			}
			else
			{
				stringBuilder.Append(c);
			}
		}
		return stringBuilder.ToString();
	}

	private static void appendTranslatedWord(StringBuilder result, string translatedText, ref string lastTranslatedWord)
	{
		int startIndexOfNextTranslatedText = 0;
		appendTranslatedWord(result, translatedText, ref lastTranslatedWord, ref startIndexOfNextTranslatedText);
	}

	private static void appendTranslatedWord(StringBuilder result, string translatedText, ref string lastTranslatedWord, ref int startIndexOfNextTranslatedText)
	{
		if (lastTranslatedWord.EndsWith("\n") || lastTranslatedWord.EndsWith("\t") || lastTranslatedWord.EndsWith(". ") || lastTranslatedWord.EndsWith("\"") || lastTranslatedWord.EndsWith("'") || lastTranslatedWord.EndsWith("? ") || lastTranslatedWord.EndsWith("! ") || lastTranslatedWord.EndsWith(".\" ") || lastTranslatedWord.EndsWith("?\" ") || lastTranslatedWord.EndsWith("!\" ") || lastTranslatedWord.EndsWith(": "))
		{
			lastTranslatedWord = toUpperCase(translatedText);
		}
		else if (lastTranslatedWord.EndsWith(" ") || lastTranslatedWord.EndsWith("("))
		{
			lastTranslatedWord = translatedText;
		}
		else
		{
			lastTranslatedWord = " " + translatedText;
		}
		if ((string.IsNullOrEmpty(translatedText) || translatedText[0] == ',' || translatedText[0] == '.' || translatedText[0] == '?' || translatedText[0] == '!') && 0 < result.Length && result[result.Length - 1] == ' ')
		{
			result = result.Remove(result.Length - 1, 1);
			startIndexOfNextTranslatedText--;
		}
		result.Append(lastTranslatedWord);
	}

	private static string toUpperCase(string text)
	{
		if (string.IsNullOrEmpty(text))
		{
			return text;
		}
		if (text.StartsWith("[") && 2 <= text.Length)
		{
			return "[" + char.ToUpper(text[1]) + ((text.Length <= 2) ? "" : text.Substring(2));
		}
		return char.ToUpper(text[0]) + ((text.Length <= 1) ? "" : text.Substring(1));
	}

	private static bool nextCharIsChinese(string chinese, int currentPhraseEndIndex)
	{
		if (chinese.Length - 1 <= currentPhraseEndIndex)
		{
			return false;
		}
		return isChinese(chinese[currentPhraseEndIndex + 1]);
	}

	private static string[] classifyWordsIntoLatinAndChinese(string inputText)
	{
		List<string> list = new List<string>();
		StringBuilder stringBuilder = new StringBuilder();
		bool flag = false;
		foreach (char c in inputText)
		{
			if (isChinese(c))
			{
				if (flag)
				{
					stringBuilder.Append(c);
				}
				else
				{
					list.Add(stringBuilder.ToString());
					stringBuilder.Length = 0;
					stringBuilder.Append(c);
				}
				flag = true;
			}
			else
			{
				if (!flag)
				{
					stringBuilder.Append(c);
				}
				else
				{
					list.Add(stringBuilder.ToString());
					stringBuilder.Length = 0;
					stringBuilder.Append(c);
				}
				flag = false;
			}
		}
		list.Add(stringBuilder.ToString());
		return list.ToArray();
	}

	private static string[] classifyWordsIntoLatinAndChineseForProxy(string inputText)
	{
		List<string> list = new List<string>();
		StringBuilder stringBuilder = new StringBuilder();
		bool flag = false;
		bool flag2 = false;
		foreach (char c in inputText)
		{
			if (flag2)
			{
				stringBuilder.Append(c);
				flag = false;
				if (c == '>')
				{
					list.Add(stringBuilder.ToString());
					stringBuilder.Length = 0;
					flag2 = false;
				}
			}
			else if (c == '<')
			{
				list.Add(stringBuilder.ToString());
				stringBuilder.Length = 0;
				stringBuilder.Append(c);
				flag2 = true;
				flag = false;
			}
			else if (isChinese(c))
			{
				if (flag)
				{
					stringBuilder.Append(c);
				}
				else
				{
					list.Add(stringBuilder.ToString());
					stringBuilder.Length = 0;
					stringBuilder.Append(c);
				}
				flag = true;
			}
			else
			{
				if (!flag)
				{
					stringBuilder.Append(c);
				}
				else
				{
					list.Add(stringBuilder.ToString());
					stringBuilder.Length = 0;
					stringBuilder.Append(c);
				}
				flag = false;
			}
		}
		list.Add(stringBuilder.ToString());
		return list.ToArray();
	}

	public static bool IsInVietPhrase(string chinese)
	{
		return vietPhraseDictionary.ContainsKey(chinese);
	}

	public static string ChineseToHanVietForAnalyzer(string chinese)
	{
		StringBuilder stringBuilder = new StringBuilder();
		for (int i = 0; i < chinese.Length; i++)
		{
			char c = chinese[i];
			if (hanVietDictionary.ContainsKey(c.ToString()))
			{
				stringBuilder.Append(hanVietDictionary[c.ToString()] + " ");
			}
			else
			{
				stringBuilder.Append(c + " ");
			}
		}
		return stringBuilder.ToString().Trim();
	}

	public static string ChineseToVietPhraseForAnalyzer(string chinese, int translationAlgorithm, bool prioritizedName)
	{
		return ChineseToVietPhraseForBrowser(chinese, 11, translationAlgorithm, prioritizedName).Trim(trimCharsForAnalyzer);
	}

	private static bool containsName(string chinese, int startIndex, int phraseLength)
	{
		if (phraseLength < 2)
		{
			return false;
		}
		if (onlyNameDictionary.ContainsKey(chinese.Substring(startIndex, phraseLength)))
		{
			return false;
		}
		int num = startIndex + phraseLength - 1;
		int num2 = 2;
		for (int i = startIndex + 1; i <= num; i++)
		{
			for (int num3 = 20; num3 >= num2; num3--)
			{
				if (chinese.Length >= i + num3 && onlyNameDictionary.ContainsKey(chinese.Substring(i, num3)))
				{
					return true;
				}
			}
		}
		return false;
	}

	private static bool isLongestPhraseInSentence(string chinese, int startIndex, int phraseLength, Dictionary<string, string> dictionary, int translationAlgorithm)
	{
		if (phraseLength < 2)
		{
			return true;
		}
		int num = ((translationAlgorithm == 0) ? phraseLength : ((phraseLength < 3) ? 3 : phraseLength));
		int num2 = startIndex + phraseLength - 1;
		for (int i = startIndex + 1; i <= num2; i++)
		{
			for (int num3 = 20; num3 > num; num3--)
			{
				if (chinese.Length >= i + num3 && dictionary.ContainsKey(chinese.Substring(i, num3)))
				{
					return false;
				}
			}
		}
		return true;
	}

	public static int GetVietPhraseDictionaryCount()
	{
		return onlyVietPhraseDictionary.Count;
	}

	public static int GetNameDictionaryCount(bool isNameChinh)
	{
		if (!isNameChinh)
		{
			return onlyNamePhuDictionary.Count;
		}
		return onlyNameChinhDictionary.Count;
	}

	public static int GetPhienAmDictionaryCount()
	{
		return hanVietDictionary.Count;
	}

	public static bool ExistInPhienAmDictionary(string chinese)
	{
		if (chinese.Length != 1)
		{
			return false;
		}
		return hanVietDictionary.ContainsKey(chinese);
	}

	private static void updateHistoryLogInCache(string key, string action, ref DataSet dictionaryHistoryDataSet)
	{
		string name = "DictionaryHistory";
		DataRow dataRow = dictionaryHistoryDataSet.Tables[name].Rows.Find(key);
		if (dataRow == null)
		{
			dictionaryHistoryDataSet.Tables[name].Rows.Add(key, action, Environment.GetEnvironmentVariable("USERNAME"), DateTime.Now);
		}
		else
		{
			dataRow[1] = action;
			dataRow[2] = Environment.GetEnvironmentVariable("USERNAME");
			dataRow[3] = DateTime.Now;
		}
	}

	private static void writeVietPhraseHistoryLog(string key, string action)
	{
		updateHistoryLogInCache(key, action, ref onlyVietPhraseDictionaryHistoryDataSet);
		WriteHistoryLog(key, action, DictionaryConfigurationHelper.GetVietPhraseDictionaryHistoryPath());
	}

	private static void writeNamesHistoryLog(string key, string action, bool isNameChinh)
	{
		DataSet dictionaryHistoryDataSet = (isNameChinh ? onlyNameDictionaryHistoryDataSet : onlyNamePhuDictionaryHistoryDataSet);
		updateHistoryLogInCache(key, action, ref dictionaryHistoryDataSet);
		WriteHistoryLog(key, action, isNameChinh ? DictionaryConfigurationHelper.GetNamesDictionaryHistoryPath() : DictionaryConfigurationHelper.GetNamesPhuDictionaryHistoryPath());
	}

	private static void writePhienAmHistoryLog(string key, string action)
	{
		updateHistoryLogInCache(key, action, ref hanVietDictionaryHistoryDataSet);
		WriteHistoryLog(key, action, DictionaryConfigurationHelper.GetChinesePhienAmWordsDictionaryHistoryPath());
	}

	public static string GetVietPhraseHistoryLogRecord(string key)
	{
		return getDictionaryHistoryLogRecordInCache(key, onlyVietPhraseDictionaryHistoryDataSet);
	}

	public static string GetNameHistoryLogRecord(string key, bool isNameChinh)
	{
		return getDictionaryHistoryLogRecordInCache(key, isNameChinh ? onlyNameDictionaryHistoryDataSet : onlyNamePhuDictionaryHistoryDataSet);
	}

	public static string GetPhienAmHistoryLogRecord(string key)
	{
		return getDictionaryHistoryLogRecordInCache(key, hanVietDictionaryHistoryDataSet);
	}

	private static string getDictionaryHistoryLogRecordInCache(string key, DataSet dictionaryHistoryDataSet)
	{
		string name = "DictionaryHistory";
		DataRow dataRow = dictionaryHistoryDataSet.Tables[name].Rows.Find(key);
		if (dataRow == null)
		{
			return "";
		}
		return string.Format("Entry này đã được <{0}> bởi <{1}> vào <{2}>.", dataRow[1], dataRow[2], ((DateTime)dataRow[3]).ToString("yyyy-MM-dd HH:mm:ss.fffzzz"));
	}

	public static void CompressPhienAmDictionaryHistory()
	{
		CompressDictionaryHistory(hanVietDictionaryHistoryDataSet, DictionaryConfigurationHelper.GetChinesePhienAmWordsDictionaryHistoryPath());
	}

	public static void CompressOnlyVietPhraseDictionaryHistory()
	{
		CompressDictionaryHistory(onlyVietPhraseDictionaryHistoryDataSet, DictionaryConfigurationHelper.GetVietPhraseDictionaryHistoryPath());
	}

	public static void CompressOnlyNameDictionaryHistory(bool isNameChinh)
	{
		CompressDictionaryHistory(isNameChinh ? onlyNameDictionaryHistoryDataSet : onlyNamePhuDictionaryHistoryDataSet, isNameChinh ? DictionaryConfigurationHelper.GetNamesDictionaryHistoryPath() : DictionaryConfigurationHelper.GetNamesPhuDictionaryHistoryPath());
	}

	private static void CompressDictionaryHistory(DataSet dictionaryHistoryDataSet, string dictionaryHistoryFilePath)
	{
		string name = "DictionaryHistory";
		string text = dictionaryHistoryFilePath + "." + DateTime.Now.Ticks;
		if (File.Exists(dictionaryHistoryFilePath))
		{
			File.Copy(dictionaryHistoryFilePath, text, overwrite: true);
		}
		using TextWriter textWriter = new StreamWriter(dictionaryHistoryFilePath, append: false, Encoding.UTF8);
		try
		{
			textWriter.WriteLine("Entry\tAction\tUser Name\tUpdated Date");
			DataTable dataTable = dictionaryHistoryDataSet.Tables[name];
			foreach (DataRow row in dataTable.Rows)
			{
				textWriter.WriteLine(string.Format("{0}\t{1}\t{2}\t{3}", row[0], row[1], row[2], ((DateTime)row[3]).ToString("yyyy-MM-dd HH:mm:ss.fffzzz")));
			}
		}
		catch (Exception ex)
		{
			try
			{
				textWriter.Close();
			}
			catch
			{
			}
			if (File.Exists(dictionaryHistoryFilePath))
			{
				try
				{
					File.Copy(text, dictionaryHistoryFilePath, overwrite: true);
				}
				catch
				{
				}
			}
			throw ex;
		}
		finally
		{
			File.Delete(text);
		}
	}

	public static void WriteHistoryLog(string key, string action, string logPath)
	{
		if (!File.Exists(logPath))
		{
			File.AppendAllText(logPath, "Entry\tAction\tUser Name\tUpdated Date\r\n", Encoding.UTF8);
		}
		File.AppendAllText(logPath, key + "\t" + action + "\t" + Environment.GetEnvironmentVariable("USERNAME") + "\t" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fffzzz") + "\r\n", Encoding.UTF8);
	}

	public static void CreateHistoryLog(string key, string action, ref StringBuilder historyLogs)
	{
		historyLogs.AppendLine(key + "\t" + action + "\t" + Environment.GetEnvironmentVariable("USERNAME") + "\t" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fffzzz"));
	}

	public static void WriteHistoryLog(string historyLogs, string logPath)
	{
		if (!File.Exists(logPath))
		{
			File.AppendAllText(logPath, "Entry\tAction\tUser Name\tUpdated Date\r\n", Encoding.UTF8);
		}
		File.AppendAllText(logPath, historyLogs, Encoding.UTF8);
	}

	private static string removeIgnoredChinesePhrases(string standardizedChinese)
	{
		if (string.IsNullOrEmpty(standardizedChinese))
		{
			return string.Empty;
		}
		string text = standardizedChinese;
		foreach (string ignoredChinesePhrase in ignoredChinesePhraseList)
		{
			text = text.Replace(ignoredChinesePhrase, string.Empty);
		}
		return text.Replace("\t\n\n", string.Empty);
	}

	private static string removeIgnoredChinesePhrasesForBrowser(string standardizedChinese)
	{
		if (string.IsNullOrEmpty(standardizedChinese))
		{
			return string.Empty;
		}
		string text = standardizedChinese;
		foreach (string ignoredChinesePhraseForBrowser in ignoredChinesePhraseForBrowserList)
		{
			text = text.Replace(ignoredChinesePhraseForBrowser, string.Empty);
		}
		return text.Replace("\t\n\n", string.Empty);
	}

	private static int containsLuatNhan(string chinese, Dictionary<string, string> dictionary)
	{
		string luatNhan;
		int matchedLength;
		return containsLuatNhan(chinese, dictionary, out luatNhan, out matchedLength);
	}

	private static int containsLuatNhan(string chinese, Dictionary<string, string> dictionary, out string luatNhan, out int matchedLength)
	{
		int length = chinese.Length;
		foreach (KeyValuePair<string, string> item in luatNhanDictionary)
		{
			if (length < item.Key.Length - 2)
			{
				continue;
			}
			string text = item.Key.Replace("{0}", "([^,\\. ?]{1,10})");
			Match match = Regex.Match(chinese, text);
			int num = 0;
			while (match.Success)
			{
				string value = match.Groups[1].Value;
				if (item.Key.StartsWith("{0}"))
				{
					for (int i = 0; i < value.Length; i++)
					{
						if (dictionary.ContainsKey(value.Substring(i)))
						{
							luatNhan = text;
							matchedLength = match.Length - i;
							return match.Index + i;
						}
					}
				}
				else if (item.Key.EndsWith("{0}"))
				{
					int num2 = value.Length;
					while (0 < num2)
					{
						if (dictionary.ContainsKey(value.Substring(0, num2)))
						{
							luatNhan = text;
							matchedLength = match.Length - (value.Length - num2);
							return match.Index;
						}
						num2--;
					}
				}
				else if (dictionary.ContainsKey(value))
				{
					luatNhan = text;
					matchedLength = match.Length;
					return match.Index;
				}
				match = match.NextMatch();
				num++;
				if (num > 1)
				{
					break;
				}
			}
		}
		luatNhan = string.Empty;
		matchedLength = -1;
		return -1;
	}

	private static bool matchesLuatNhan(string chinese, Dictionary<string, string> dictionary)
	{
		foreach (KeyValuePair<string, string> item in luatNhanDictionary)
		{
			string text = item.Key.Replace("{0}", "(.+)");
			Match match = Regex.Match(chinese, "^" + text + "$");
			if (match.Success && dictionary.ContainsKey(match.Groups[1].Value))
			{
				return true;
			}
		}
		return false;
	}

	private static bool matchesLuatNhan(string chinese, Dictionary<string, string> dictionary, string luatNhan)
	{
		Match match = Regex.Match(chinese, "^" + luatNhan + "$");
		if (match.Success && dictionary.ContainsKey(match.Groups[1].Value))
		{
			return true;
		}
		return false;
	}

	public static string ChineseToLuatNhan(string chinese, Dictionary<string, string> dictionary)
	{
		string luatNhan = string.Empty;
		return ChineseToLuatNhan(chinese, dictionary, out luatNhan);
	}

	public static string ChineseToLuatNhan(string chinese, Dictionary<string, string> dictionary, out string luatNhan)
	{
		_ = chinese.Length;
		foreach (KeyValuePair<string, string> item in luatNhanDictionary)
		{
			string text = item.Key.Replace("{0}", "(.+)");
			Match match = Regex.Match(chinese, "^" + text + "$");
			if (match.Success && dictionary.ContainsKey(match.Groups[1].Value))
			{
				string[] array = dictionary[match.Groups[1].Value].Split('/', '|');
				StringBuilder stringBuilder = new StringBuilder();
				string[] array2 = array;
				foreach (string newValue in array2)
				{
					stringBuilder.Append(item.Value.Replace("{0}", newValue));
					stringBuilder.Append("/");
				}
				luatNhan = item.Key;
				return stringBuilder.ToString().Trim('/');
			}
		}
		throw new NotImplementedException("Lỗi xử lý luật nhân cho cụm từ: " + chinese);
	}
}
