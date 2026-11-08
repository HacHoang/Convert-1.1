using System.IO;
using System.Reflection;

namespace TranslatorEngine;

public class DictionaryConfigurationHelper
{
	private static string directoryPath = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);

	private static string thuatToanNhan = string.Empty;

	public static bool IsNhanByPronouns
	{
		get
		{
			if (string.IsNullOrEmpty(thuatToanNhan))
			{
				readThuatToanNhan();
			}
			return thuatToanNhan == "1";
		}
	}

	public static bool IsNhanByPronounsAndNames
	{
		get
		{
			if (string.IsNullOrEmpty(thuatToanNhan))
			{
				readThuatToanNhan();
			}
			return thuatToanNhan == "2";
		}
	}

	public static bool IsNhanByPronounsAndNamesAndVietPhrase
	{
		get
		{
			if (string.IsNullOrEmpty(thuatToanNhan))
			{
				readThuatToanNhan();
			}
			return thuatToanNhan == "3";
		}
	}

	public static string GetNamesPhuDictionaryPath()
	{
		return GetDictionaryPathByKey("NamesPhu");
	}

	public static string GetNamesDictionaryPath()
	{
		return GetDictionaryPathByKey("Names");
	}

	public static string GetNamesDictionaryHistoryPath()
	{
		return Path.Combine(Path.GetDirectoryName(GetNamesDictionaryPath()), Path.GetFileNameWithoutExtension(GetNamesDictionaryPath()) + "History" + Path.GetExtension(GetNamesDictionaryPath()));
	}

	public static string GetNamesPhuDictionaryHistoryPath()
	{
		return Path.Combine(Path.GetDirectoryName(GetNamesPhuDictionaryPath()), Path.GetFileNameWithoutExtension(GetNamesPhuDictionaryPath()) + "History" + Path.GetExtension(GetNamesPhuDictionaryPath()));
	}

	public static string GetVietPhraseDictionaryPath()
	{
		return GetDictionaryPathByKey("VietPhrase");
	}

	public static string GetVietPhraseDictionaryHistoryPath()
	{
		return Path.Combine(Path.GetDirectoryName(GetVietPhraseDictionaryPath()), Path.GetFileNameWithoutExtension(GetVietPhraseDictionaryPath()) + "History" + Path.GetExtension(GetVietPhraseDictionaryPath()));
	}

	public static string GetChinesePhienAmWordsDictionaryPath()
	{
		return GetDictionaryPathByKey("ChinesePhienAmWords");
	}

	public static string GetChinesePhienAmWordsDictionaryHistoryPath()
	{
		return Path.Combine(Path.GetDirectoryName(GetChinesePhienAmWordsDictionaryPath()), Path.GetFileNameWithoutExtension(GetChinesePhienAmWordsDictionaryPath()) + "History" + Path.GetExtension(GetChinesePhienAmWordsDictionaryPath()));
	}

	public static string GetChinesePhienAmEnglishWordsDictionaryPath()
	{
		return GetDictionaryPathByKey("ChinesePhienAmEnglishWords");
	}

	public static string GetCEDictDictionaryPath()
	{
		return GetDictionaryPathByKey("CEDict");
	}

	public static string GetBabylonDictionaryPath()
	{
		return GetDictionaryPathByKey("Babylon");
	}

	public static string GetLacVietDictionaryPath()
	{
		return GetDictionaryPathByKey("LacViet");
	}

	public static string GetThieuChuuDictionaryPath()
	{
		return GetDictionaryPathByKey("ThieuChuu");
	}

	public static string GetIgnoredChinesePhraseListPath()
	{
		return GetDictionaryPathByKey("IgnoredChinesePhrases");
	}

	public static string GetLuatNhanDictionaryPath()
	{
		return GetDictionaryPathByKey("LuatNhan");
	}

	public static string GetPronounsDictionaryPath()
	{
		return GetDictionaryPathByKey("Pronouns");
	}

	private static string GetDictionaryPathByKey(string dictionaryKey)
	{
		string[] array = File.ReadAllLines(Path.Combine(directoryPath, "Dictionaries.config"));
		string text = string.Empty;
		string[] array2 = array;
		foreach (string text2 in array2)
		{
			if (!string.IsNullOrEmpty(text2) && !text2.StartsWith("#") && text2.StartsWith(dictionaryKey + "="))
			{
				text = text2.Split('=')[1];
				break;
			}
		}
		if (!Path.IsPathRooted(text))
		{
			text = Path.Combine(directoryPath, text);
		}
		if (!File.Exists(text))
		{
			throw new FileNotFoundException("Dictionary Not Found: " + text);
		}
		return text;
	}

	private static void readThuatToanNhan()
	{
		string[] array = File.ReadAllLines(Path.Combine(directoryPath, "Dictionaries.config"));
		string[] array2 = array;
		foreach (string text in array2)
		{
			if (!string.IsNullOrEmpty(text) && !text.StartsWith("#") && text.StartsWith("ThuatToanNhan="))
			{
				thuatToanNhan = text.Split('=')[1];
				break;
			}
		}
	}
}
